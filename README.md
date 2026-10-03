# Unified Cloud File Manager (React Web Edition)

> "A unified interface for managing authorized files across multiple Google Accounts."
> Storage remains owned, metered, and enforced by each respective Google Account.

## Overview

Unified Cloud File Manager is a web application and multi-account cloud gallery rewritten from the original Android implementation to React with TypeScript and Tailwind CSS. It aggregates authorized files from multiple personally-owned Google Accounts through a unified, responsive interface while strictly preserving multi-account isolation, quota governance, and security redaction guarantees.

## Core Architectural Invariants Preserved

- **Account Isolation (`I-1` through `I-8`)**: Every operation requires an explicit `accountId`. Provider file IDs are never mixed across accounts (`FI-07`).
- **Token State Machine (`AccountStateMachine`)**: Manages account lifecycle transitions (`DISCONNECTED`, `AUTHORIZING`, `CONNECTED`, `REFRESHING`, `REAUTH_REQUIRED`) with enforcement of verification rules (`SM-6`) and disconnect cache purges (`ST-4`).
- **Quota Governor (`QuotaGovernor`)**: Client-side concurrency control enforcing per-account limits (4 requests), global limits (8 requests), and a 120-request rolling window budget.
- **Dynamic Action Resolution (`ResolveFileActions`)**: Pure decision function resolving available actions (`OPEN`, `DOWNLOAD`, `EXPORT`, `RENAME`, `MOVE`, `COPY`, `TRASH`, `RESTORE`, `DELETE_PERMANENTLY`, `SHARE`, `VIEW_REVISIONS`, `STAR`) with explicit, truthful unavailability reasons (`ScopeInsufficient`, `FileCannot`, `FileInTrash`).
- **Security & Redaction (`Redactor`)**: FNV-1a correlation hashing (`refTag#...`), OAuth token scrubbing (`ya29...`, `1//...`, `GOCSPX-...`), and email masking to domain level.
- **Durable Write Queue (`PendingOperation`)**: Tracks in-flight, queued, and uncertain write operations with reconciliation safeguards preventing duplicate uploads (`X-1`).

## Tech Stack

- **Framework**: React 19 + TypeScript + Vite
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Dev Server**: Vite listening on `0.0.0.0:3000`
