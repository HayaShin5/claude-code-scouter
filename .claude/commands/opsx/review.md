---
name: "OPSX: Review"
description: Review an OpenSpec artifact for quality, consistency, and completeness
category: Workflow
tags: [workflow, review, quality, experimental]
---

Review an OpenSpec artifact to catch issues before moving to the next step.

**Input**: Optionally specify a change name after `/opsx:review` (e.g., `/opsx:review add-auth`). If omitted, infer from context or prompt for selection.

**Steps**

1. **Resolve change name**

   If no change name provided, run `openspec list --json` and use **AskUserQuestion tool** to let the user select.

2. **Get current status**
   ```bash
   openspec status --change "<name>" --json
   ```
   Identify artifacts with `status: "done"` — these are the review targets.

3. **Determine which artifact to review**

   Review the **most recently created** artifact (the last one with `status: "done"` in dependency order).

   If the user specifies an artifact name (e.g., `/opsx:review add-auth proposal`), review that specific artifact.

4. **Read the artifact and its dependencies**

   - Read the target artifact file
   - Read all dependency artifacts for cross-referencing

5. **Spawn a review Agent**

   Use the **Agent tool** to spawn a review agent. The agent MUST:

   - Review the artifact independently (fresh perspective)
   - Apply the review criteria below based on artifact type
   - Return a structured review result

   Provide the agent with:
   - The full content of the artifact being reviewed
   - The content of dependency artifacts (for consistency checks)
   - The artifact type and review criteria

   **Agent prompt template**:
   ```
   You are a senior technical reviewer. Review the following OpenSpec artifact critically.

   Artifact type: <type>
   Artifact content:
   <content>

   Dependency artifacts:
   <dependency contents>

   Review criteria:
   <criteria for this artifact type - see below>

   Return your review in this exact format:

   ## Review Result

   **Verdict**: PASS | NEEDS_REVISION

   ### Issues Found
   (List each issue with severity: CRITICAL / WARNING / SUGGESTION)

   For each issue:
   - **[SEVERITY]** Brief description
     - Location: Which section or line
     - Problem: What's wrong
     - Fix: Specific actionable fix

   ### What's Good
   (Brief note on strengths — 1-2 lines max)

   Rules:
   - Be strict. The goal is to catch problems before they propagate to downstream artifacts.
   - CRITICAL = will cause implementation problems if not fixed
   - WARNING = should fix for clarity/quality
   - SUGGESTION = minor improvement
   - Verdict is NEEDS_REVISION if any CRITICAL or 2+ WARNING issues exist
   - Do NOT be vague. Every issue must have a specific, actionable fix.
   - Do NOT praise excessively. Focus on problems.
   ```

6. **If verdict is NEEDS_REVISION: fix and re-review**

   - Apply all CRITICAL and WARNING fixes to the artifact
   - Re-read the updated artifact
   - Spawn a NEW review Agent (fresh context, no anchoring to previous review)
   - Repeat until verdict is PASS or max 3 iterations reached

   If max iterations reached with remaining issues, show the remaining issues to the user and ask for direction.

7. **Show review summary**

   After PASS:
   ```
   ✓ Review passed: <artifact-name>
     Iterations: N
     Issues fixed: M
   ```

   If stopped at max iterations:
   ```
   ⚠ Review stopped after 3 iterations
     Remaining issues: N
     [list remaining CRITICAL/WARNING issues]
   ```

**Review Criteria by Artifact Type**

**proposal.md**:
- [ ] 課題が具体的で、なぜ今解決する必要があるか明確
- [ ] スコープが明確（何をやる・やらないが分かる）
- [ ] Capabilityの分割が適切（粒度が大きすぎ/小さすぎないか）
- [ ] 各Capabilityが独立していて、相互依存が最小限
- [ ] 既知の制約・限界が明示されている
- [ ] 技術的な実現可能性に無理がない

**specs/<capability>/spec.md**:
- [ ] proposalのCapabilityと整合している
- [ ] 要件が検証可能（テスト可能な形で書かれている）
- [ ] シナリオが主要なユースケースをカバーしている
- [ ] エッジケース・異常系が考慮されている
- [ ] 他のspecとの境界が明確

**design.md**:
- [ ] proposal/specの要件を満たす設計になっている
- [ ] 技術選定の理由が明確（なぜその技術/アプローチか）
- [ ] トレードオフが検討されている（採用しなかった案とその理由）
- [ ] コンポーネント間の責務分担が明確
- [ ] 既存コードベースとの整合性がある
- [ ] 実装の複雑さが必要最小限

**tasks.md**:
- [ ] design.mdの設計を網羅している（漏れがない）
- [ ] タスクの粒度が適切（1タスク = 1つの明確な変更）
- [ ] 依存関係の順序が正しい（先にやるべきことが先にある）
- [ ] 各タスクが具体的で、何をすれば完了か明確
- [ ] テストタスクが含まれている

**Guardrails**
- レビューは必ずAgentツールで別エージェントとして実行する（セルフレビューのバイアスを避ける）
- 修正後の再レビューも新しいAgentで実行する（前回のレビューに引きずられない）
- 最大3イテレーションで打ち切る（無限ループ防止）
- SUGGESTIONは修正しない（CRITICALとWARNINGのみ修正）
- レビュー結果はユーザーに表示する（透明性）
