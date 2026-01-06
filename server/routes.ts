import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.get(api.status.path, (_req, res) => {
    res.json({ status: "ok" });
  });

  return httpServer;
}
