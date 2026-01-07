import Stripe from 'stripe';
import { storage } from './storage';
import { SUBSCRIPTION_TIERS, type SubscriptionTierId } from '@shared/schema';

// Initialize Stripe with secret key
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

export const stripe = STRIPE_SECRET_KEY
  ? new Stripe(STRIPE_SECRET_KEY)
  : null;

// Map Stripe price IDs to tier IDs
const PRICE_TO_TIER: Record<string, SubscriptionTierId> = {
  [process.env.STRIPE_STARTER_PRICE_ID || 'price_starter']: 'starter',
  [process.env.STRIPE_TRADER_PRICE_ID || 'price_trader']: 'trader',
  [process.env.STRIPE_PRO_PRICE_ID || 'price_pro']: 'pro',
  [process.env.STRIPE_DESK_PRICE_ID || 'price_desk']: 'desk',
};

// Map tier IDs to Stripe price IDs
const TIER_TO_PRICE: Record<SubscriptionTierId, string | null> = {
  free: null,
  starter: process.env.STRIPE_STARTER_PRICE_ID || null,
  trader: process.env.STRIPE_TRADER_PRICE_ID || null,
  pro: process.env.STRIPE_PRO_PRICE_ID || null,
  desk: process.env.STRIPE_DESK_PRICE_ID || null,
};

export function isStripeConfigured(): boolean {
  return !!stripe;
}

/**
 * Create or retrieve a Stripe customer for a user
 */
export async function getOrCreateCustomer(userId: string, email: string): Promise<string> {
  if (!stripe) throw new Error('Stripe not configured');

  // Check if user already has a customer ID
  const subscription = await storage.getUserSubscription(userId);
  if (subscription?.stripeCustomerId) {
    return subscription.stripeCustomerId;
  }

  // Create new customer
  const customer = await stripe.customers.create({
    email,
    metadata: { userId },
  });

  // Store customer ID
  await storage.createOrUpdateSubscription({
    userId,
    stripeCustomerId: customer.id,
    tier: 'free',
    status: 'active',
  });

  return customer.id;
}

/**
 * Create a checkout session for subscription
 */
export async function createCheckoutSession(
  userId: string,
  email: string,
  tier: SubscriptionTierId,
  successUrl: string,
  cancelUrl: string
): Promise<string> {
  if (!stripe) throw new Error('Stripe not configured');

  const priceId = TIER_TO_PRICE[tier];
  if (!priceId) {
    throw new Error(`No price configured for tier: ${tier}`);
  }

  const customerId = await getOrCreateCustomer(userId, email);

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      userId,
      tier,
    },
    subscription_data: {
      metadata: {
        userId,
        tier,
      },
    },
  });

  return session.url || '';
}

/**
 * Create a billing portal session for managing subscription
 */
export async function createBillingPortalSession(
  userId: string,
  returnUrl: string
): Promise<string> {
  if (!stripe) throw new Error('Stripe not configured');

  const subscription = await storage.getUserSubscription(userId);
  if (!subscription?.stripeCustomerId) {
    throw new Error('No customer found for user');
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: subscription.stripeCustomerId,
    return_url: returnUrl,
  });

  return session.url;
}

/**
 * Handle Stripe webhook events
 */
export async function handleWebhookEvent(
  body: string | Buffer,
  signature: string
): Promise<{ received: boolean; type?: string }> {
  if (!stripe || !STRIPE_WEBHOOK_SECRET) {
    console.error('Stripe or webhook secret not configured');
    return { received: false };
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    throw new Error('Invalid webhook signature');
  }

  console.log(`Processing Stripe webhook: ${event.type}`);

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      await handleCheckoutComplete(session);
      break;
    }

    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription;
      await handleSubscriptionUpdate(subscription);
      break;
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;
      await handleSubscriptionCanceled(subscription);
      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice;
      await handlePaymentFailed(invoice);
      break;
    }

    case 'invoice.paid': {
      const invoice = event.data.object as Stripe.Invoice;
      await handleInvoicePaid(invoice);
      break;
    }

    default:
      console.log(`Unhandled event type: ${event.type}`);
  }

  return { received: true, type: event.type };
}

async function handleCheckoutComplete(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.userId;
  const tier = session.metadata?.tier as SubscriptionTierId;

  if (!userId) {
    console.error('No userId in checkout session metadata');
    return;
  }

  console.log(`Checkout complete for user ${userId}, tier: ${tier}`);

  // The subscription update will be handled by the subscription.created webhook
}

async function handleSubscriptionUpdate(subscription: Stripe.Subscription) {
  const userId = subscription.metadata?.userId;
  if (!userId) {
    // Try to find by customer ID
    const customerSub = await storage.getSubscriptionByStripeCustomerId(
      subscription.customer as string
    );
    if (!customerSub) {
      console.error('Cannot find user for subscription:', subscription.id);
      return;
    }
    // Use the found user ID
    await updateUserSubscription(customerSub.userId, subscription);
    return;
  }

  await updateUserSubscription(userId, subscription);
}

async function updateUserSubscription(userId: string, subscription: Stripe.Subscription) {
  const firstItem = subscription.items.data[0];
  const priceId = firstItem?.price.id;
  const tier = priceId ? (PRICE_TO_TIER[priceId] || 'free') : 'free';

  const status = subscription.status === 'active' || subscription.status === 'trialing'
    ? 'active'
    : subscription.status === 'past_due'
      ? 'past_due'
      : subscription.status === 'canceled'
        ? 'canceled'
        : 'active';

  // Get billing period from subscription item
  const periodStart = firstItem?.current_period_start
    ? new Date(firstItem.current_period_start * 1000)
    : null;
  const periodEnd = firstItem?.current_period_end
    ? new Date(firstItem.current_period_end * 1000)
    : null;

  await storage.createOrUpdateSubscription({
    userId,
    tier,
    status,
    stripeSubscriptionId: subscription.id,
    stripeCustomerId: subscription.customer as string,
    stripePriceId: priceId || null,
    currentPeriodStart: periodStart,
    currentPeriodEnd: periodEnd,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    // Reset monthly usage at the start of each billing period
    monthlyAnalysesUsed: 0,
    monthlyResetDate: new Date().toISOString().split('T')[0],
  });

  console.log(`Updated subscription for user ${userId}: tier=${tier}, status=${status}`);
}

async function handleSubscriptionCanceled(subscription: Stripe.Subscription) {
  const existingSub = await storage.getSubscriptionByStripeSubscriptionId(subscription.id);
  if (!existingSub) {
    console.error('Cannot find subscription to cancel:', subscription.id);
    return;
  }

  await storage.updateSubscription(existingSub.userId, {
    tier: 'free',
    status: 'canceled',
    stripeSubscriptionId: null,
    stripePriceId: null,
    currentPeriodStart: null,
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
  });

  console.log(`Subscription canceled for user ${existingSub.userId}`);
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const subscription = await storage.getSubscriptionByStripeCustomerId(invoice.customer as string);
  if (!subscription) {
    console.error('Cannot find subscription for failed payment');
    return;
  }

  await storage.updateSubscription(subscription.userId, {
    status: 'past_due',
  });

  console.log(`Payment failed for user ${subscription.userId}`);
}

async function handleInvoicePaid(invoice: Stripe.Invoice) {
  const subscription = await storage.getSubscriptionByStripeCustomerId(invoice.customer as string);
  if (!subscription) return;

  // Reset monthly usage on successful payment (new billing period)
  await storage.resetMonthlyUsage(subscription.userId);

  console.log(`Invoice paid for user ${subscription.userId}, monthly usage reset`);
}

/**
 * Get subscription tier info for pricing display
 */
export function getSubscriptionTiers() {
  return Object.entries(SUBSCRIPTION_TIERS).map(([id, tier]) => {
    // Handle free tier's special properties
    const freeTierProps = id === 'free' ? {
      trialDays: (tier as typeof SUBSCRIPTION_TIERS.free).trialDays,
      trialAnalysesPerDay: (tier as typeof SUBSCRIPTION_TIERS.free).trialAnalysesPerDay,
      postTrialAnalysesPerWeek: (tier as typeof SUBSCRIPTION_TIERS.free).postTrialAnalysesPerWeek,
    } : {};

    // Get price ID from server-side mapping
    const priceId = TIER_TO_PRICE[id as SubscriptionTierId] || null;

    return {
      id,
      name: tier.name,
      price: tier.price,
      priceId,
      features: tier.features,
      analysesPerMonth: tier.analysesPerMonth,
      leaderboardLimit: tier.leaderboardLimit,
      popular: tier.popular,
      ...freeTierProps,
    };
  });
}
