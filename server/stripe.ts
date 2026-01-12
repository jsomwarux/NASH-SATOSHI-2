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
  [process.env.STRIPE_PRO_PRICE_ID || 'price_pro']: 'pro',
  [process.env.STRIPE_PREMIUM_PRICE_ID || 'price_premium']: 'premium',
};

// Map tier IDs to Stripe price IDs
const TIER_TO_PRICE: Record<SubscriptionTierId, string | null> = {
  free: null,
  pro: process.env.STRIPE_PRO_PRICE_ID || null,
  premium: process.env.STRIPE_PREMIUM_PRICE_ID || null,
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
  cancelUrl: string,
  referralCode?: string
): Promise<string> {
  if (!stripe) throw new Error('Stripe not configured');

  const priceId = TIER_TO_PRICE[tier];
  if (!priceId) {
    throw new Error(`No price configured for tier: ${tier}`);
  }

  const customerId = await getOrCreateCustomer(userId, email);

  // Build metadata with optional referral code
  const metadata: Record<string, string> = {
    userId,
    tier,
  };
  if (referralCode) {
    metadata.ref = referralCode;
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    client_reference_id: userId, // For affiliate tracking
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
    metadata,
    subscription_data: {
      metadata,
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
      // Check if this is a credit purchase or subscription
      if (session.metadata?.type === 'credit_purchase') {
        await handleCreditPurchase(session);
      } else {
        await handleCheckoutComplete(session);
      }
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
 * Sync subscription status directly from Stripe
 * This fetches the current subscription for a user and updates our database
 * Useful when webhooks haven't been received (e.g., after billing portal changes)
 */
export async function syncSubscriptionFromStripe(userId: string): Promise<{
  success: boolean;
  tier?: string;
  status?: string;
  error?: string;
}> {
  if (!stripe) {
    return { success: false, error: 'Stripe not configured' };
  }

  try {
    // Get the user's subscription record to find their Stripe customer ID
    const userSub = await storage.getUserSubscription(userId);

    if (!userSub?.stripeCustomerId) {
      // No Stripe customer - they're on free tier
      return { success: true, tier: 'free', status: 'active' };
    }

    // Fetch active subscriptions for this customer (not canceled ones)
    const subscriptions = await stripe.subscriptions.list({
      customer: userSub.stripeCustomerId,
      status: 'active',
      limit: 10,
      expand: ['data.items.data.price'],
    });

    if (subscriptions.data.length === 0) {
      // No active subscription - check for trialing
      const trialingSubscriptions = await stripe.subscriptions.list({
        customer: userSub.stripeCustomerId,
        status: 'trialing',
        limit: 1,
        expand: ['data.items.data.price'],
      });

      if (trialingSubscriptions.data.length === 0) {
        // No active or trialing subscription - downgrade to free
        await storage.createOrUpdateSubscription({
          userId,
          tier: 'free',
          status: 'active',
          stripeCustomerId: userSub.stripeCustomerId,
          stripeSubscriptionId: null,
          stripePriceId: null,
          currentPeriodStart: null,
          currentPeriodEnd: null,
          cancelAtPeriodEnd: false,
        });
        return { success: true, tier: 'free', status: 'active' };
      }

      // Use trialing subscription
      subscriptions.data.push(...trialingSubscriptions.data);
    }

    // Get the most recent/active subscription
    const subscription = subscriptions.data[0];
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

    // Get billing period from subscription item (same as in webhook handler)
    const periodStart = firstItem?.current_period_start
      ? new Date(firstItem.current_period_start * 1000)
      : null;
    const periodEnd = firstItem?.current_period_end
      ? new Date(firstItem.current_period_end * 1000)
      : null;

    // Use createOrUpdateSubscription to handle both new and existing records
    await storage.createOrUpdateSubscription({
      userId,
      tier: tier as SubscriptionTierId,
      status,
      stripeCustomerId: userSub.stripeCustomerId,
      stripeSubscriptionId: subscription.id,
      stripePriceId: priceId || null,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    });

    console.log(`Synced subscription from Stripe for user ${userId}: tier=${tier}, status=${status}`);

    return { success: true, tier, status };
  } catch (error) {
    console.error('Error syncing subscription from Stripe:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to sync subscription';
    return { success: false, error: errorMessage };
  }
}

/**
 * Verify and sync subscription from a checkout session
 * This is called after the user returns from Stripe checkout
 * to ensure the subscription is updated even if webhooks haven't arrived
 */
export async function verifyAndSyncCheckoutSession(sessionId: string, userId: string): Promise<{
  success: boolean;
  tier?: string;
  error?: string;
}> {
  if (!stripe) {
    return { success: false, error: 'Stripe not configured' };
  }

  try {
    // Retrieve the checkout session
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription'],
    });

    // Verify this session belongs to this user
    if (session.metadata?.userId !== userId) {
      return { success: false, error: 'Session does not belong to this user' };
    }

    // Check if payment was successful
    if (session.payment_status !== 'paid') {
      return { success: false, error: 'Payment not completed' };
    }

    // Get the subscription
    const subscription = session.subscription as Stripe.Subscription | null;
    if (!subscription) {
      return { success: false, error: 'No subscription found in session' };
    }

    // Update the user's subscription in our database
    const firstItem = subscription.items.data[0];
    const priceId = firstItem?.price.id;
    const tier = priceId ? (PRICE_TO_TIER[priceId] || 'free') : 'free';

    const status = subscription.status === 'active' || subscription.status === 'trialing'
      ? 'active'
      : subscription.status === 'past_due'
        ? 'past_due'
        : 'active';

    const periodStart = firstItem?.current_period_start
      ? new Date(firstItem.current_period_start * 1000)
      : null;
    const periodEnd = firstItem?.current_period_end
      ? new Date(firstItem.current_period_end * 1000)
      : null;

    await storage.createOrUpdateSubscription({
      userId,
      tier: tier as SubscriptionTierId,
      status,
      stripeSubscriptionId: subscription.id,
      stripeCustomerId: subscription.customer as string,
      stripePriceId: priceId || null,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      monthlyAnalysesUsed: 0,
      monthlyResetDate: new Date().toISOString().split('T')[0],
    });

    console.log(`Verified and synced subscription for user ${userId}: tier=${tier}`);

    return { success: true, tier };
  } catch (error) {
    console.error('Error verifying checkout session:', error);
    return { success: false, error: 'Failed to verify session' };
  }
}

/**
 * Create a checkout session for credit pack purchase (one-time)
 */
export async function createCreditCheckoutSession(
  userId: string,
  email: string,
  packId: string,
  credits: number,
  price: number,
  successUrl: string,
  cancelUrl: string,
  referralCode?: string
): Promise<string> {
  if (!stripe) throw new Error('Stripe not configured');

  const customerId = await getOrCreateCustomer(userId, email);

  // Build metadata with optional referral code
  const metadata: Record<string, string> = {
    userId,
    type: 'credit_purchase',
    packId,
    credits: credits.toString(),
  };
  if (referralCode) {
    metadata.ref = referralCode;
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    client_reference_id: userId, // For affiliate tracking
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: `${credits} Analysis Credits`,
            description: `Top up your account with ${credits} additional analyses that never expire.`,
          },
          unit_amount: price * 100, // Convert to cents
        },
        quantity: 1,
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata,
  });

  return session.url || '';
}

/**
 * Handle credit purchase completion
 */
export async function handleCreditPurchase(session: Stripe.Checkout.Session): Promise<void> {
  const userId = session.metadata?.userId;
  const packId = session.metadata?.packId;
  const credits = parseInt(session.metadata?.credits || '0', 10);

  if (!userId || !packId || !credits) {
    console.error('Missing metadata in credit purchase session');
    return;
  }

  // Add credits to user's account
  await storage.addCredits(
    userId,
    credits,
    packId,
    session.amount_total || 0,
    session.payment_intent as string
  );

  console.log(`Added ${credits} credits to user ${userId} (pack: ${packId})`);
}

/**
 * Verify and complete a credit purchase from checkout session
 */
export async function verifyAndCompleteCreditPurchase(sessionId: string, userId: string): Promise<{
  success: boolean;
  credits?: number;
  error?: string;
}> {
  if (!stripe) {
    return { success: false, error: 'Stripe not configured' };
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    // Verify this session belongs to this user
    if (session.metadata?.userId !== userId) {
      return { success: false, error: 'Session does not belong to this user' };
    }

    // Verify this is a credit purchase
    if (session.metadata?.type !== 'credit_purchase') {
      return { success: false, error: 'Not a credit purchase session' };
    }

    // Check if payment was successful
    if (session.payment_status !== 'paid') {
      return { success: false, error: 'Payment not completed' };
    }

    const packId = session.metadata.packId;
    const credits = parseInt(session.metadata.credits || '0', 10);

    if (!credits) {
      return { success: false, error: 'No credits in session' };
    }

    // Add credits to user's account
    await storage.addCredits(
      userId,
      credits,
      packId,
      session.amount_total || 0,
      session.payment_intent as string
    );

    console.log(`Verified and added ${credits} credits to user ${userId}`);

    return { success: true, credits };
  } catch (error) {
    console.error('Error verifying credit purchase:', error);
    return { success: false, error: 'Failed to verify purchase' };
  }
}

/**
 * Get subscription tier info for pricing display
 */
export function getSubscriptionTiers() {
  return Object.entries(SUBSCRIPTION_TIERS).map(([id, tier]) => {
    // Get price ID from server-side mapping
    const priceId = TIER_TO_PRICE[id as SubscriptionTierId] || null;

    return {
      id,
      name: tier.name,
      price: tier.price,
      priceId,
      features: tier.features,
      leaderboardAccess: tier.leaderboardAccess,
      votesPerDay: tier.votesPerDay,
      priorityVotes: tier.priorityVotes,
      tagline: tier.tagline,
      popular: tier.popular,
    };
  });
}
