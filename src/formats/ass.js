import formatTimestamp from '../utils/formatTimestamp';
import padZero from '../utils/padZero';

function formatter({ H, M, S, SS }) {
  return `${H}:${padZero(M, 2)}:${padZero(S, 2)}.${padZero(SS, 2)}`;
}

const NEW_LINE = '\r\n';
const header = `
[Script Info]
; Script generated by Aegisub 3.2.2
; http://www.aegisub.org/
Title: {{ title }}
ScriptType: v4.00+
WrapStyle: 0
ScaledBorderAndShadow: yes
YCbCr Matrix: TV.601
PlayResX: 1280
PlayResY: 720

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Lynda,Constantia,50,&H00FFFFFF,&H000000FF,&H005C390E,&H0C141415,0,0,0,0,100,100,0,0,1,2.5,2.2,2,17,17,36,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`
.trim()
.replace(/\n/g, NEW_LINE);

export default function generateAssSubtle(options) {
  const { transcriptData, tutorialTitle, videoTotalLength } = options;

  const content = [
    header.replace('{{ title }}', tutorialTitle),
    transcriptData.map((item, idx) => {
      const { start, text } = item;
      const nextItem = transcriptData[idx + 1];
      const end = nextItem ? nextItem.start : videoTotalLength;
      return `Dialogue: 0,${formatTimestamp(start, formatter)},${formatTimestamp(end, formatter)},Lynda,,0,0,0,,{\\blur1.2}${text}`;
    }).join(NEW_LINE),
  ];

  return {
    content: content.join(NEW_LINE).trim() + NEW_LINE,
    ext: '.ass',
  };
}