# Research: How are top Claude Code skills promoted?

You are doing market research for **王建硕**'s `wjs-*` Claude Code skills. Your job: figure out what makes a skill go viral / get adopted on the public skills marketplaces, and write findings to `state/research.md`.

## What to investigate (use WebFetch / WebSearch)

1. **ClawHub** (https://clawhub.ai) — what's trending on the homepage? Sort by downloads/recent. Open 5–10 top skills, look at:
   - Their `description` field (length, tone, keyword density)
   - Their README hook (first sentence)
   - Whether they include screenshots / gifs / demo videos
   - How they signal "this works" (testimonials, install count, GitHub stars)

2. **agentskills.io** (the SKILL.md spec home) — read the spec freshly each time. Are there new fields? New best practices in the example skills?

3. **SkillsMP** (https://skillsmp.com) — what categories exist? Where do video / content / Chinese-localized skills sit?

4. **X (Twitter) search** — use `xurl search` to find recent posts mentioning "Claude Code skill" / "claude-skill" / "/wjs-" / specific top skills:
   - `xurl search "claude code skill" -n 50`
   - `xurl search "SKILL.md" -n 30`
   - `xurl search "claude skills" -n 30`
   - What angles got 100+ likes? What didn't?

5. **Reddit r/ClaudeAI** — top posts of last 30 days mentioning skills. What got upvoted? What got downvoted as "self-promo"?

6. **Hacker News** — search `hn.algolia.com` for "claude code" + "skill". What Show HN posts succeeded?

7. **OpenClaw** ecosystem — if you find OpenClaw / Hermes / similar agent platforms that adopted the SKILL.md spec, note their distribution mechanisms.

## What to write

Write `state/research.md`. Required sections:

```markdown
# Marketplace Research — <YYYY-MM-DD>

## Top 10 trending skills this period
For each: name, marketplace, one-line value prop, what's distinctive about its promotion.

## Description-field patterns that work
3–5 bullets on length / structure / keyword density / tone that correlates with adoption.

## X post patterns that get traction
3–5 bullets. Cite specific posts (URL + like count). Note: anything > 100 likes for solo dev posts.

## Reddit r/ClaudeAI patterns
What kind of post gets upvoted. What gets the "no self-promo" reaction.

## HN Show HN patterns
Specific successful titles and structures.

## Anti-patterns (what tanked)
Posts/skills you found that flopped. Why.

## Recommendations for 王建硕's wjs-* skills
Specific, actionable. Given his existing style (实用、具体、不吹牛, see ~/code/claude-skills/README.md), what marketplace conventions should he adopt vs ignore?
```

## Constraints

- **Cite sources**. Every claim points to a URL.
- **Quote, don't paraphrase**, when calling out language patterns. We want to see the actual words.
- **Don't make up data**. If you can't access a marketplace, say so. Better to have 6 real findings than 12 with 6 invented.
- **Budget: ≤ 30 fetches**. If you can't conclude after 30, summarize what you have.
- **Output language: Chinese (Simplified)** for the recommendations section, English OK for quoted material.

## When done

Write `state/research.md` and print its path. Do not modify any other files.
