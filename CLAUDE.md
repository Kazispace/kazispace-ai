# kazispace-ai — working rules for Claude

The KaziSpace web app (Next.js). Entry point: [`README.md`](README.md).

## 1. Reviewing a pull request: post it, then watch it

> **Source:** the user of a Claude Code session, 2026-10-27, word for word: "by default : post
> your review, and subscribe PR status" (right after two PR reviews in that session). This is an
> agent's record of a chat instruction, not a decision document; if disputed, ask the user who gave it.

- When asked to review a pull request, **post the review on that pull request by default**
  (a comment ending with the Claude Code footer). Do not ask first, and do not leave the review
  only in the chat.
- Right after posting, **subscribe to the pull request** with `subscribe_pr_activity`, without asking.
- If subscribing fails, say so and schedule a check-in with `send_later` about 50 minutes out
  instead. Re-arm it quietly (about every 4 hours) while nothing changes; stop after 3 quiet
  check-ins in a row, or once the pull request is merged or closed.
- When the author pushes new commits, review the new diff and post a follow-up comment.
- This covers posting and watching only. It does not allow pushing to someone else's branch,
  approving, or merging.
