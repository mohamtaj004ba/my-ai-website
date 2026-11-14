# Sanitized legacy recovery provider denial

Documented observations; no recovered ownership or successful maintenance claim.

```json
{
  "version": "legacy-recovery-denial-documentation-v1",
  "sourceCommit": "0fa19a54205c886058b53154716c281e35c7308d",
  "runtime": {
    "environment": "preview",
    "commit": "0fa19a54205c886058b53154716c281e35c7308d",
    "origin": "https://my-ai-website-kzhebyi43-mohamtaj004bas-projects.vercel.app",
    "branch": "feature/callercore-dashboards",
    "deploymentId": "dpl_9wo1dTxywFGkFpAYRomg4cU4Kav8",
    "release": {
      "version": "organization-contracts-v4",
      "digest": "7b1636aa99a43cb3331d5bf07cd9b8e2cf1d69308c8ca16ef2a2eecb32a5b644"
    }
  },
  "code": "ENG_LEGACY_PROJECT_PROOF",
  "trace": {
    "version": "vercel-phase-diagnostics-v1",
    "adapterDeadlineMs": 6000,
    "admissionDeadlineMs": 10000,
    "totalElapsedMs": 2794,
    "activePhases": [],
    "events": [
      {
        "phase": "connection-status",
        "elapsedMs": 444,
        "outcome": "completed"
      },
      {
        "phase": "adapter-authorize",
        "elapsedMs": 189,
        "outcome": "completed"
      },
      {
        "phase": "broker-owner",
        "elapsedMs": 190,
        "outcome": "completed"
      },
      {
        "phase": "broker-record",
        "elapsedMs": 64,
        "outcome": "completed"
      },
      {
        "phase": "broker-owner",
        "elapsedMs": 191,
        "outcome": "completed"
      },
      {
        "phase": "broker-task",
        "elapsedMs": 189,
        "outcome": "completed"
      },
      {
        "phase": "broker-recheck",
        "elapsedMs": 62,
        "outcome": "completed"
      },
      {
        "phase": "credential-open",
        "elapsedMs": 1,
        "outcome": "completed"
      },
      {
        "phase": "broker-owner",
        "elapsedMs": 188,
        "outcome": "completed"
      },
      {
        "phase": "broker-task",
        "elapsedMs": 189,
        "outcome": "completed"
      },
      {
        "phase": "broker-recheck",
        "elapsedMs": 63,
        "outcome": "completed"
      },
      {
        "phase": "configuration-http",
        "elapsedMs": 203,
        "outcome": "http-403"
      },
      {
        "phase": "configuration-read",
        "elapsedMs": 643,
        "outcome": "unconfirmed"
      },
      {
        "phase": "credential-broker",
        "elapsedMs": 1343,
        "outcome": "unconfirmed"
      },
      {
        "phase": "final-connection",
        "elapsedMs": 435,
        "outcome": "completed"
      }
    ],
    "failures": [
      "VCO_HTTP_403",
      "VC_UNCLASSIFIED",
      "VC_UNCLASSIFIED"
    ]
  },
  "maintenanceStatus": {
    "version": "legacy-maintenance-status-v1",
    "entries": [],
    "executionAuthority": false
  },
  "unchangedCleanupSnapshot": "10aa444f5d04e130724dce693e990d20c2b22ede77ad76e091ecfc533d7e1379",
  "cleanupCategoryCounts": {
    "unrevoked-pilot-grant": 2,
    "legacy-unverified": 3
  },
  "ownedGrants": [
    {
      "id": "grant_4dbceb45ac77b52ce55644ff2527b793",
      "revision": 2,
      "mode": "pilot",
      "revoked": true,
      "expiresAt": 1792122953827,
      "authority": "owner-workspace",
      "revocationEligible": false
    },
    {
      "id": "grant_57b72aa43ee37e69c5901b1eec4cd02f",
      "revision": 2,
      "mode": "pilot",
      "revoked": true,
      "expiresAt": 1792134125896,
      "authority": "owner-workspace",
      "revocationEligible": false
    },
    {
      "id": "grant_e3fe3869fdfd5ffa15732e220f365050",
      "revision": 2,
      "mode": "pilot",
      "revoked": true,
      "expiresAt": 1792138599008,
      "authority": "owner-workspace",
      "revocationEligible": false
    },
    {
      "id": "grant_12bb37fa2c7f8d85b238752a49b56f0d",
      "revision": 2,
      "mode": "pilot",
      "revoked": true,
      "expiresAt": 1792143282496,
      "authority": "owner-workspace",
      "revocationEligible": false
    },
    {
      "id": "grant_7299c9eed7559f7837dc0d9ea8627a70",
      "revision": 2,
      "mode": "pilot",
      "revoked": true,
      "expiresAt": 1792180316630,
      "authority": "owner-workspace",
      "revocationEligible": false
    }
  ],
  "financialBefore": {
    "expanded": {
      "id": "owner-expanded-engineering-5usd-v1",
      "version": "owner-expanded-engineering-5usd-v1",
      "cumulativeMicros": 5000000,
      "dayMicros": 5000000,
      "monthMicros": 5000000,
      "retainedMicros": 1000000,
      "remainingMicros": 4000000,
      "pendingMicros": 1000000,
      "knownSettledMicros": 0,
      "basis": "all retained ceilings; settled token usage separate; not invoice reconciled"
    },
    "historical": {
      "version": "owner-development-15usd-v1",
      "cumulativeMicros": 15000000,
      "dayMicros": 15000000,
      "monthMicros": 15000000,
      "retainedMicros": 12600000,
      "remainingMicros": 2400000,
      "pendingMicros": 4200000,
      "knownSettledMicros": 225938,
      "basis": "all retained ceilings; settled token usage separate; not invoice reconciled"
    },
    "reconciliation": {
      "expanded": {
        "version": "retained-exposure-explanation-v1",
        "knownSettledMicros": 0,
        "pendingResponsesMicros": 40014,
        "recordedUsageMicros": 40014,
        "conservativeRemainderMicros": 959986,
        "unpricedCountingRequests": 5,
        "releasableMicros": 0,
        "invoiceReconciled": false,
        "basis": "Reservation-recorded Responses usage is contained within retained ceilings, not additional exposure; failed-stage observed usage may exist separately in diagnostic receipts and is not included here. Unpriced counting, interrupted requests and invoice adjustments remain unresolved; no automatic release."
      },
      "historical": {
        "version": "retained-exposure-explanation-v1",
        "knownSettledMicros": 225938,
        "pendingResponsesMicros": 48064,
        "recordedUsageMicros": 274002,
        "conservativeRemainderMicros": 12325998,
        "unpricedCountingRequests": 10,
        "releasableMicros": 0,
        "invoiceReconciled": false,
        "basis": "Reservation-recorded Responses usage is contained within retained ceilings, not additional exposure; failed-stage observed usage may exist separately in diagnostic receipts and is not included here. Unpriced counting, interrupted requests and invoice adjustments remain unresolved; no automatic release."
      }
    }
  },
  "financialAfter": {
    "expanded": {
      "id": "owner-expanded-engineering-5usd-v1",
      "version": "owner-expanded-engineering-5usd-v1",
      "cumulativeMicros": 5000000,
      "dayMicros": 5000000,
      "monthMicros": 5000000,
      "retainedMicros": 1000000,
      "remainingMicros": 4000000,
      "pendingMicros": 1000000,
      "knownSettledMicros": 0,
      "basis": "all retained ceilings; settled token usage separate; not invoice reconciled"
    },
    "historical": {
      "version": "owner-development-15usd-v1",
      "cumulativeMicros": 15000000,
      "dayMicros": 15000000,
      "monthMicros": 15000000,
      "retainedMicros": 12600000,
      "remainingMicros": 2400000,
      "pendingMicros": 4200000,
      "knownSettledMicros": 225938,
      "basis": "all retained ceilings; settled token usage separate; not invoice reconciled"
    },
    "reconciliation": {
      "expanded": {
        "version": "retained-exposure-explanation-v1",
        "knownSettledMicros": 0,
        "pendingResponsesMicros": 40014,
        "recordedUsageMicros": 40014,
        "conservativeRemainderMicros": 959986,
        "unpricedCountingRequests": 5,
        "releasableMicros": 0,
        "invoiceReconciled": false,
        "basis": "Reservation-recorded Responses usage is contained within retained ceilings, not additional exposure; failed-stage observed usage may exist separately in diagnostic receipts and is not included here. Unpriced counting, interrupted requests and invoice adjustments remain unresolved; no automatic release."
      },
      "historical": {
        "version": "retained-exposure-explanation-v1",
        "knownSettledMicros": 225938,
        "pendingResponsesMicros": 48064,
        "recordedUsageMicros": 274002,
        "conservativeRemainderMicros": 12325998,
        "unpricedCountingRequests": 10,
        "releasableMicros": 0,
        "invoiceReconciled": false,
        "basis": "Reservation-recorded Responses usage is contained within retained ceilings, not additional exposure; failed-stage observed usage may exist separately in diagnostic receipts and is not included here. Unpriced counting, interrupted requests and invoice adjustments remain unresolved; no automatic release."
      }
    }
  },
  "engineeringAuthority": {
    "outstanding": false,
    "responseRequestsDispatched": 0,
    "tokenCountRequestsDispatched": 0,
    "observedAt": 1792279020417,
    "runtime": {
      "environment": "preview",
      "commit": "0fa19a54205c886058b53154716c281e35c7308d",
      "origin": "https://my-ai-website-kzhebyi43-mohamtaj004bas-projects.vercel.app",
      "branch": "feature/callercore-dashboards",
      "deploymentId": "dpl_9wo1dTxywFGkFpAYRomg4cU4Kav8",
      "sourceCommit": "0fa19a54205c886058b53154716c281e35c7308d",
      "release": {
        "version": "organization-contracts-v4",
        "digest": "7b1636aa99a43cb3331d5bf07cd9b8e2cf1d69308c8ca16ef2a2eecb32a5b644"
      }
    },
    "basis": "stored-scoped-authority-and-dispatch-journal-not-provider-liveness",
    "executionAuthorized": false
  },
  "paidExecution": false,
  "acceptance": false,
  "publication": false,
  "generatedCodeExecution": false,
  "separateProviderMetadata": {
    "observedAt": "2026-10-17T23:18:09.926Z",
    "source": "0fa19a54205c886058b53154716c281e35c7308d",
    "projectId": "prj_AkD7VoSNCE6fRYXQnXkX1ywGqjLX",
    "teamId": "team_6Rg3DdCrvOml6oEGwx6Ndf1I",
    "storedConfigurationId": "icfg_GGSQXkNuda6GuMLYb9vgA3aZ",
    "callerCoreCredential": {
      "operation": "GET integration configuration",
      "httpStatus": 403,
      "source": "sealed existing broker diagnostics",
      "deploymentReadReached": false
    },
    "separateTeamAdminRead": {
      "operation": "GET /v1/integrations/configuration/{id}",
      "httpStatus": 404,
      "code": "not_found",
      "requestId": "sfo1:sfo1::5dmcf-1792279032091-76842bd12cb4"
    },
    "filteredTeamInstallationList": {
      "view": "account",
      "integrationIdOrSlug": "callercore-agent-operations",
      "count": 0
    },
    "qualification": "Stored installation is not currently accessible/visible through the checked provider paths. Do not infer who removed it or its exact lifecycle cause. Stored metadata is not present provider access proof.",
    "providerMutations": 0,
    "credentialValuesRead": false,
    "ownerAction": "Review and restore consent for existing integration registration and selected project; no duplicate app/key needed."
  },
  "localEvidenceFiles": {
    "LEGACY_0FA_PROJECT_PROOF_403.txt": "dc326ef06445f14125e4fdb6e3803ca8710d96c32cd3dbdf415527707e923bb8",
    "LEGACY_0FA_STATUS_AFTER_DENIAL.json": "1dc36d54d3f433dc3d937a525f0c18f13a9289ded560c9208a08aec44f7504c8",
    "LEGACY_0FA_AFTER_DENIAL_READINESS.json": "d8f3c96a942853631b3517a38a3dcbdf01f76ff1cd0347eaeaae56b749cb6f9f",
    "LEGACY_13E_BEFORE_READINESS.json": "e1a3774894a23dc57f96d383051ebb9f7c7a139e035e40c394785246704a807f",
    "LEGACY_0FA_PROVIDER_INSTALLATION_METADATA.json": "d4890c43039b8db87f6534910522457c5cc359d33f02fdea82e8bde75e2e9150",
    "PHASE_D_0FA_DENIAL_EVIDENCE_WORK_QA_REVIEW.json": "a4870f5efa7e378f4ea84febc8bb665b3890d9244db3c9eda11dca36c8ad7c62",
    "PHASE_D_0FA_DENIAL_OUTCOME_WORK_AUDITOR_REVIEW.json": "18e2ff1b00628536f9add6de88bf4fdc38f8b2cdb1612a9d94c015eabbf5a4c2"
  },
  "qualification": "Sanitized documented API/provider observations and local immutable file identities. No raw datastore export or signed provider billing proof. No maintenance claim/apply, provider credential change, paid request or financial mutation."
}
```
