# Monkey sprite prompt template

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
A small cartoon monkey character: large round head, ochre skin (#D4673A), big sparkly black eyes with white highlights, pink blush cheeks, small triangle ears, soft black ink outlines (#2C1810), holding a small grey hammer in the right hand, 3/4 side view.
```

## State-specific poses

| State | Pose prompt |
|-------|-------------|
| idle  | standing relaxed, slight smile, hammer held at side, breathing pose, eyes open looking forward |
| hit   | hammer swung up over right shoulder, focused eyes, mouth open in concentration, body slightly leaning back |
| combo | jumping in mid-air, hammer raised triumphantly with both hands, big toothy smile, motion lines around body |
| taunt | leaning forward slightly, eyes squinted shut, tongue sticking out to one side, cheek puffed, hammer resting on shoulder |
| miss  | shoulders drooped, head tilted down, eyes looking at ground sadly, hammer hanging limp at side, small frown |

## Generation

Generate each state in its own run. After the first successful generation, reuse
the same seed for all subsequent states of this character for consistency.

```bash
mmx image generate \
  --prompt "<STYLE_PREFIX> <CHARACTER_CARD> <STATE_POSE>" \
  --negative "<NEGATIVE>" \
  --width 256 --height 256 --seed <SEED> \
  --output out/sprites/monkey/<state>-1.png
```
