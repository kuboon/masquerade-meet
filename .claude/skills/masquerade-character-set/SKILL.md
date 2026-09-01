---
name: masquerade-character-set
description: Build a page that publishes a masquerade character set — a roster of characters with artwork and disguised voices that visitors can take into a masq.kbn.one meeting. Use when someone wants to make, publish, check, or fix a character set, or asks about the `?set=` link, the character-set JSON format, or the voice axes (size/weight/nasal/roughness/throat).
---

# Publishing a masquerade character set

A character set is a JSON document on somebody's own site. Link to
`https://masq.kbn.one/new?set=<its url>` and the room that opens wears those
characters. There is nothing to register with masq.

The full format reference is `docs/character-sets.md` in
`kuboon/masquerade-meet`. Read it before writing a set; this file is about how
to go about the job.

## The one rule that is not negotiable

**Every character's voice must be a disguise, or the whole set is refused.**

A voice qualifies if any of these holds:

- `size` at least ±0.17 (two semitones)
- `throat` at least ±0.25
- `roughness` at least 0.3

`weight` and `nasal` do not count however far they are pushed — they colour a
voice, they do not hide it.

This is not a style guide. A set of zeroes would put a roomful of people on a
call in their own voices while telling them they were disguised, and they
would have no way to notice. So the room refuses the set, and everyone gets
the built-in characters instead.

Refusal is silent to whoever followed the link. **They will not be told the
set failed.** So check before publishing — see below.

## Doing the work

### 1. Settle the roster

Ask how many characters, unless it is obvious. **The count is the room's
capacity**: eight characters seats eight people, and a ninth cannot join. The
built-in sets are fifteen. Fewer than about six makes for a small meeting.

Each character needs a picture. Ask where the artwork is coming from before
writing anything — a set with no images is not a set. Square-ish images work
best; they are shown as tiles.

### 2. Spread the voices out

This is the part that takes judgement, and the part that is most often done
badly. Two rules:

**Nobody sits near zero.** A body the same size as the speaker's own leaves
them recognisable, which is the one thing a mask may not do.

**Leave a gap between neighbours.** If two characters are 0.1 apart in `size`
nobody can tell them apart, and the whole point is that people cannot tell who
is who. Lay the cast out across the range and space them: for fifteen
characters, roughly `-0.95` to `+0.95` with about 0.13 between each.

Then colour them with `weight`, `nasal`, `roughness` and `throat` so that two
characters at similar sizes still read as different people. `throat` is the
one that makes a voice sound like something that is not a person at all — a
deep voice out of a tiny mouth — so it belongs to the characters that are not
people.

Do not claim a voice sounds like anything in particular. Nobody can hear these
numbers by reading them. Write plausible values, then send the author to the
preview (step 4) and expect to change them.

### 3. Write the page

Prefer **one HTML file** with the set embedded, so there is a single thing to
publish:

```html
<script type="application/masquerade-character-set+json">
	{
		"name": "サーカス団",
		"tagline": "天幕の下に集まった、はぐれ者の一座",
		"characters": [
			{
				"id": "lion",
				"name": "ライオン",
				"emoji": "🦁",
				"tagline": "ごろごろ重低音",
				"image": "lion.png",
				"voice": {
					"size": -0.95,
					"weight": -0.6,
					"nasal": -0.05,
					"roughness": 0.2
				}
			}
		]
	}
</script>
```

The page should show the characters and carry the button:

```html
<a href="https://masq.kbn.one/new?set=https%3A%2F%2Fexample.com%2Fcircus%2F">
	このキャラセットでマスカレードする
</a>
```

**URL-encode the `?set=` value.** An unencoded address loses everything after
its own `?` or `&`, and the failure is silent.

The address in that link is the page's own published URL, so you need to know
where it will live. Ask if you do not.

Alternatively write `set.json` beside the page and point the link at the JSON.
Both work; the embedded version is one file instead of two.

### 4. Check it, and get it listened to

Never tell the author a set is finished without this.

Before publishing, from the repo:

```
deno run --allow-read=set.json jsr:@kuboon/masquerade-character-set/cli set.json
```

Only the permission the argument needs — the file it reads, or, for a URL,
`--allow-net=<host>`. Never `-A`: this reads a stranger's document and then
fetches the address inside it. With no permissions at all it still runs and
names the flag it wanted.

Once it is published, `https://masq.kbn.one/character-set?url=<the url>`
checks the live thing and lets them record five seconds of their own voice
and hear it as each character. That is the only way the numbers in step 2 get
settled — say so, and offer to adjust them afterwards.

If the author has a TypeScript build, `@kuboon/masquerade-character-set`
provides the types and `/preview` runs the same voice engine on their own
page.

## Things that go wrong

|                                             |                                                                                                     |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Room opens with the built-in characters     | The set was refused. Run the checker; it says why.                                                  |
| Everything after `?` in the link is missing | The `?set=` value was not URL-encoded.                                                              |
| Images do not appear                        | They must be `https:`. Relative paths resolve against the JSON's own URL. `data:` URIs are refused. |
| Room seats fewer people than expected       | Capacity is the number of characters.                                                               |
| A ninth person cannot join                  | Same.                                                                                               |

## Never do these

- **Never change a character `id` that has been published.** Rooms store it;
  renaming strands rooms that are already running. Add characters instead.
- **Never suggest lowering the disguise threshold or working around it.** It
  is the app's one promise.
- **Never put artwork in a `data:` URI.** The whole document is capped at
  64 KB and images are fetched separately for good reason.
- **Never leave out that the images are fetched from the author's own host**,
  which means their server sees every participant. Say it once, plainly.
