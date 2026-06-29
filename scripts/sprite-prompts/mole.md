# Mole sprite prompt template

Use with the `mmx` CLI (see mmx-cli skill). The character card + style prefix
must be appended to every state-specific pose.

## Style prefix

```
Children's picture book illustration, flat color fills with hand-drawn ink outlines, soft warm palette, single character, soft cream paper background (#F5EBD7) so the sprite blends with the game canvas, character centered in frame, 256x256 px.
```

## Negative

```
realistic fur, vector graphic, low poly, 3D render, shading gradients, busy background, photorealistic, NSFW, white background, groundhog, bear
```

## Character card

```
A small cartoon mole character: small round body, warm brown fur (#8B6F47), tiny dark eyes, prominent pink nose (#FFC0CB), soft black ink outlines (#2C1810), short stubby limbs, large rounded head with tiny ears, 3/4 front view.
```

## State-specific poses

| State      | Pose prompt |
|------------|-------------|
| rising     | peeking out of a hole, only upper body and head visible above the hole edge, eyes wide and alert, ears perked up |
| active     | standing on hind legs full body visible, neutral cute expression, small paws at sides |
| retreating | lowering into a hole, only upper body still visible, eyes worried, paws gripping the edge of the hole |
| hit        | stunned pose, stars and impact marks circling head, eyes spiraled X X, body slightly tilted, mouth open |
| taunting   | eyes squinted in a sly grin, tongue sticking out, pink cheeks visible, leaning to one side with attitude |

## Generation

```bash
mmx image generate \
  --prompt "<STYLE_PREFIX> <CHARACTER_CARD> <STATE_POSE>" \
  --negative "<NEGATIVE>" \
  --width 512 --height 512 --seed <SEED> \
  --out out/sprites/mole/<state>-1.png
```
