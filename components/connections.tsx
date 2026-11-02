"use client";
import { Bell, CreditCard, LogOut, ShieldCheck, Sparkles } from "lucide-react";
import type { IntegrationStatus } from "@/lib/types";

export default function Connections({ integrations, onSignOut }: { integrations: IntegrationStatus; onSignOut: () => void }) {
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Connections</h1>
        </div>
      </div>
      <div className="connection-list">
        {[
          { name: "Groq", connected: integrations.groq, icon: Sparkles, keys: "GROQ_API_KEY · GROQ_MODEL" },
          {
            name: "PayPal Sandbox",
            connected: integrations.paypal,
            icon: CreditCard,
            keys: "PAYPAL_CLIENT_ID · PAYPAL_CLIENT_SECRET · PAYPAL_SELLER_EMAIL",
          },
          {
            name: "PayPal webhooks",
            connected: integrations.webhook,
            icon: Bell,
            keys: "PAYPAL_WEBHOOK_ID · endpoint: /api/paypal/webhook",
          },
          { name: "Password", connected: integrations.protected, icon: ShieldCheck, keys: "APP_PASSWORD · SESSION_SECRET" },
        ].map((connection) => (
          <div className="panel connection-card" key={connection.name}>
            <span className="connection-icon">
              <connection.icon size={23} />
            </span>
            <div>
              <h3>{connection.name}</h3>
              <code>{connection.keys}</code>
            </div>
            <span className={`badge ${connection.connected ? "green" : "neutral"}`}>
              {connection.connected ? "Configured" : "Not connected"}
            </span>
          </div>
        ))}
      </div>
      <button className="text-button" onClick={onSignOut}>
        <LogOut size={16} />
        Sign out
      </button>
    </>
  );
}
