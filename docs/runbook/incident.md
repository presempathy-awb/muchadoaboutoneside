# Incident response

This runbook covers a suspected application, publication or privacy incident. It describes a response process; it does not claim that automated detection, paging, or an on-call service exists.

## Establish the facts

Record the time, affected public release or snapshot, observed behavior, and the smallest reproduction that explains the issue. Use file hashes and relevant test results when available. Keep private files, personal information, credentials, full draft contents and raw request data out of public reports. Preserve necessary evidence in an appropriately restricted location; do not copy unrelated data.

Arrange a private maintainer reporting route as described in [SECURITY.md](../../SECURITY.md). If private material was published, determine where it appeared and whether independent public copies or caches may exist. Removing a file from the latest snapshot does not erase repository history or external copies.

## Contain within authority

Identify a narrowly scoped containment step and who is authorized to perform it. For example, disable an optional shared draft relay when its behavior is implicated, pause publication, or roll back an affected application release through the deployment's established process. Check that the containment preserves required public access and does not expose private data.

Do not change unrelated services, delete evidence indiscriminately, or rotate credentials without the appropriate operator authority. If a credential may have leaked, its owner should revoke or rotate it through the relevant provider and assess its actual access. Treat browser or desktop work under the project's explicit scoped consent rules.

## Repair and verify

Prepare a focused fix and independent review. Run a regression that demonstrates the failure and the repaired behavior, then the relevant repository checks, build and HTTP smoke tests. For publication incidents, check the sanitized export selection and known-private exclusions and verify the independent public snapshot. For draft incidents, distinguish browser-local data from optional shared server files and their backups.

Deploy or publish only through the authorized workflow. Record the reviewed commit, verification evidence, containment and recovery steps, and any unresolved exposure or retention limitations. A healthy endpoint alone does not prove the incident is resolved.

## Communicate and follow up

Give affected people an accurate description of known impact, actions taken and remaining uncertainty. Share only the incident details needed for understanding and remediation. Agree on disclosure timing and audience with the responsible maintainers; do not claim guaranteed deletion from backups or third-party copies.

After recovery, document the cause, useful detection and test improvements, and any policy or reporting-channel gaps. Update the [privacy notes](../../PRIVACY.md), [security guidance](../../SECURITY.md), and contributor documents when the implemented behavior changes.
