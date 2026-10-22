---
title: "AI Agent Gateways: how to reclaim control of your agents, tools and token budgets"
metaTitle: "AI Agent Gateways: reclaiming control of agents, tools and token budgets"
description: "Four gates sit between your AI agents and the real world: cost, policy, auth and audit. Concepts, use cases, when it is worth a pilot, and the open source platforms to look at."
eyebrow: Theme · Radar vol. 1
dek: The four gates between your AI agents and the real world, and the open source platforms that build them.
date: 2026-10-22
factsChecked: 2026-10-22

tldr:
  - "Once an agent can call tools, every call is an action: it can change data, send a message or spend money."
  - "A gateway puts four checks on that path in one place: **cost**, **policy**, **auth** and **audit**."
  - Open source options now cover most of it. Some bundle several layers, others do one job and compose.

question: Which layer do you run today? Tell me on LinkedIn.

# How this post appears on the home page.
card:
  eyebrow: Theme · AI/ML · Infra
  title: "AI Agent Gateways: reclaiming control of your agents, tools and token budgets"
  summary: "Four gates sit between an agent and the real world: cost, policy, auth and audit. What they do, two worked use cases, a decision lens, and the open source platforms to look at."
  chips: [CONCEPTS, USE CASES, WHEN TO USE, PLATFORMS]
  image: /assets/diagrams/InfoFlow.webp
  imageAlt: "Infographic: how an action gateway handles a tool call in seven steps"
---

## Concepts {#concepts}

Agents used to answer. Now they act. A support bot issues refunds, a coding agent opens pull requests, an ops agent emails customers. Each of those is a tool call with real consequences, and the checks around them often live in a few lines of code inside each agent.

An **AI agent gateway** (also called an action gateway) moves those checks out of agent code and into one shared layer. The agent never talks to a tool directly. Security and platform teams get a single place to say yes or no.

### The gateway in one picture {#gate}

```gate
description: An agent or LLM app sends a tool call through the action gateway, which applies identity, policy, limits and audit, before reaching tools and APIs.
caller: { label: CALLER, title: Agent or LLM app, text: Wants to run a tool }
gateway:
  label: ACTION GATEWAY
  checks:
    - { title: Identity, text: "Which agent, on whose behalf" }
    - { title: Policy, text: Is this tool and argument allowed }
    - { title: Limits, text: "Rate, quota and cost caps" }
    - { title: Audit, text: "Who called what, and the decision" }
targets: { label: TARGETS, title: Tools and APIs, text: "MCP servers, other agents, internal REST APIs" }
caption: "Two protocols make this layer more relevant: MCP connects agents to tools, and A2A connects agents to other agents. More connections means more surface to govern."
```

### A tool call, step by step {#lifecycle}

Here is what the gateway does with a single call. Notice that two of the seven steps can stop the call before it reaches the tool, and that the tool credentials are added by the gateway, never held by the agent.

![Infographic of the seven steps an action gateway takes: receive the call, authenticate, authorize (deny returns 403), apply limits (limit returns 429), forward to the tool with the right credentials, record the decision, and return the result.](/assets/diagrams/InfoFlow.webp "Request lifecycle. Tap the image to open it full size.")

### Four layers {#layers}

The gateway is easiest to understand as four separate jobs. You may meet them bundled in one product or as separate tools. Each answers one question.

```layers
- kind: SPEND
  title: Cost proxy
  icon: wallet
  text: Sits between agents and model providers and keeps spend inside a budget. It throttles, routes and stops calls before the bill surprises you.
  points:
    - "**Budgets:** caps per team, key or agent. Calls stop at the limit."
    - "**Throttling:** requests and tokens per minute, so one agent cannot starve the rest."
    - "**Routing:** spreads load across providers and falls back when one fails."
  question: How much can this agent spend, and where?
  example: e.g. LiteLLM

- kind: PERMISSION
  title: Policy engine
  icon: shield
  text: Checks whether a specific tool call is allowed before it runs. It looks at the tool, its arguments and who is asking, then allows, denies or escalates to a person.
  points:
    - "**Tool and arguments:** rules see what is called and with which values."
    - "**Context:** who is asking, for whom, when and how often."
    - "**Rules as code:** policies live in Git and get reviewed like any change."
  question: Is this agent allowed to do this, right now?
  example: e.g. OPA · Cedar

- kind: CREDENTIALS
  title: Auth proxy
  icon: key
  text: Gives the agent a stand-in token and swaps in the real credential at the last moment. The agent never holds a secret worth stealing.
  points:
    - "**No secrets in agents:** a leaked stand-in token is scoped, short-lived and revocable."
    - "**Interception:** the proxy sits inline and rewrites the auth header on the way out."
    - "**Rerouting:** the agent calls the proxy's URL, and the proxy calls the real API."
  question: Can a leaked agent token do real damage?
  example: e.g. agentgateway · Pomerium

- kind: EVIDENCE
  title: Audit proxy
  icon: ledger
  text: Records every tool call, the decision behind it and the result, so any action can be traced and replayed later.
  points:
    - "**Who and what:** agent, user, tool and arguments on every call."
    - "**Decision and reason:** allowed, denied or escalated, and by which rule or person."
    - "**Replay:** rebuild exactly what happened in an incident review."
  question: What did this agent do last Tuesday, and why?
  example: e.g. OpenTelemetry → SIEM
```

Most teams start with the layer that hurts most today, often cost or credentials. Some gateways bundle several layers, others do one job well and compose with the rest.

### Anatomy of a gateway {#anatomy toc="Anatomy"}

Inside, the layers become seven components on the request path. Four supporting systems configure them: your identity provider, a policy repository, a secrets vault and your observability stack.

![Architecture diagram. Clients (coding agent, support bot, ops agent) enter the data plane: protocol listeners, authentication, policy, limits, credentials, router and audit. The router reaches MCP servers, internal APIs and other agents. The control plane (identity provider, policy repo, secrets vault, observability) configures the data plane.](/assets/diagrams/LArchSchematic.webp "Data plane on the request path, control plane that configures it.")

### Four ways to put a gate in front of agent actions {#approaches toc="Four ways to build"}

Platforms differ more in approach than in features. This cheat sheet groups them by where the gate sits, and when each shape tends to fit.

![Cheat sheet of four approaches: an agent-native gateway (agentgateway), a federating registry (ContextForge), an identity-aware proxy (Pomerium), and extending your existing proxy with a policy engine (Envoy AI Gateway plus OPA). Evaluate identity, policy depth, limits, audit, protocols and exit cost.](/assets/diagrams/InfoCheatsheet.webp "Not ranked. No paid placements.")

## Use cases {#usecases}

Two examples show the layers working together. The amounts, caps and counts are illustrations, not recommendations.

### 1 · An agent wants to refund $240 {#refund toc="Refund with approval"}

A support agent asks to refund an order. The gateway first identifies who is asking and for which customer, and checks a daily refund cap. Then policy decides by amount: small refunds pass straight through, larger ones wait for a person to approve in Slack. Either way, the payment key is injected by the gateway, and the decision is written to the audit record.

![Flow diagram: a support agent requests a $240 refund. The action gateway identifies the caller, checks a refund cap of 20 per agent per day, then branches on amount: up to $100 is auto-approved, above that a finance lead approves in Slack. The Stripe refund runs with a key injected by the gateway, and an audit record is written.](/assets/diagrams/LUseRefund.webp "Policy decides by amount, a person approves the risky ones, and the Stripe key never reaches the agent.")

> **Layers at work**
> Auth proxy (key injection) · Policy engine (amount rule, escalation) · Cost/limits (refund cap) · Audit proxy (decision record).

### 2 · An agent wants to email 340 customers {#email toc="Email under a cap"}

Sending is cheap, so the risk is volume. The gateway dedupes recipients, enforces a per-hour and per-day cap, and checks that each recipient has opted in. What does not go out today is held for tomorrow and the owner is notified. Failures retry with backoff, and nothing is sent twice. Anything that still fails lands in a dead-letter queue and alerts a person.

![Flow diagram: a nightly ops agent wants to email 340 people. The action gateway identifies the sender, dedupes to one email per person per 24 hours, checks the cap of 50 per hour and 200 per day, and checks opted-in recipients. Excess is held for tomorrow. Sent email carries an idempotency key; failures retry with backoff up to three times, then dead-letter and alert a person. Everything is audited.](/assets/diagrams/LUseEmail.webp "Cap per day, not just per second. Retries never send twice. Held and failed mail stays visible.")

> **Layers at work**
> Limits (caps, dedupe) · Policy engine (recipient check) · Audit proxy (sent, held, failed, by whom).

## When to use it {#decide}

A gateway is another system to run, so the useful question is whether your situation has the problem it solves. Work down the three questions. A “no” is a perfectly good place to stop, and the radar will still be here when the answer changes.

```decide
steps:
  - ask: Can agent tool calls change data, spend money or reach customers?
    no: Log calls in the app. Revisit soon.
  - ask: Do several agents or teams share the same tools?
    no: Policy in the agent runtime is enough for now.
  - ask: Will security ask for per-tool permissions and an audit trail?
    no: A shared library may do. Watch the space.
verdict:
  label: WORTH A PILOT
  text: Put one gateway in front of your riskiest tools and measure what it catches.
```

### Questions to ask before a pilot

1. Which tool calls can change data, move money or reach customers?
2. Do you need to know which human an agent acted for?
3. Where do policies live today, and who reviews them?
4. Can you replay a decision for an audit or incident review?
5. What happens to your setup if you switch gateways later?

## Platforms available {#platforms toc="Platforms"}

These are the open source projects on the radar for this theme. Placements describe where a project stands today and are not endorsements. Facts below come from each project's repository and were checked on 22 Oct 2026. Evidence tags show how I know: all of these are `researched`, meaning read and assessed, not yet used.

### At a glance {#compare}

```compare
```

All repositories were active at the time of checking (pushes within the previous few days, none archived). “Not placed” means the radar has not yet assigned a ring.
{.small}

### Each platform {#details}

```platforms
```

### License watch {#license-watch}

> **Worth a line in your evaluation**
> Seven of the eight are plain Apache 2.0 (the eighth entry is a technique, not software). LiteLLM is the one to read carefully: an MIT core with a commercial `enterprise/` directory. Agent Router changed its name, home and governance while keeping the license, so check the current repository when you search. Governance for Cedar is still [CHECK].

Whichever you pick, evaluate the same six things: identity (agent and on-behalf-of user), policy depth (per tool, per argument), limits (rate, quota, cost), audit (replayable decisions), protocols (MCP, A2A, REST) and exit cost (how portable your policies are).
