# Mole sprite prompt template

Use with the `mmx` CLI (see mmx-cli skill). The character card + style prefix
must be appended to every state-specific pose.

## Style prefix

```
Children's picture book illustration, flat color fills with hand-drawn ink outlines, soft warm palette, single character, white background, character centered in frame, 256x256 px.
```

## Negative

```
realistic fur, vector graphic, low poly, 3D render, shading gradients, busy background, photorealistic, NSFW
```

## Character card

```
A small cartoon mole character: warm brown body (#8B6F47), small round body, big sparkly black eyes with white highlights, two small white front teeth showing, pink nose (#FFC0CB), soft black ink outlines (#2C1810), standing on hind legs, 3/4 front view.
```

## State-specific poses

| State      | Pose prompt |
|------------|-------------|
| rising     | peeking out of hole, only upper body visible, eyes wide and alert, ears perked up |
| active     | standing on hind legs, neutral cute expression, two front teeth showing, small paws at sides |
| retreating | lowering into hole, only upper body still visible, eyes worried, paws gripping the edge |
| hit        | stunned pose, stars and impact marks circling head, eyes spiraled X X, body slightly tilted, mouth open |
| taunting   | eyes squinted in a sly grin, tongue sticking out, pink cheeks visible, leaning to one side with attitude |

## Generation

```bash
mmx image generate \
  --prompt "<STYLE_PREFIX> <CHARACTER_CARD> <STATE_POSE>" \
  --negative "<NEGATIVE>" \
  --width 256 --height 256 --seed <SEED> \
  --output out/sprites/mole/<state>-1.png
```
