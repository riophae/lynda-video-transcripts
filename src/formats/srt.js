import formatTimestamp from '../utils/formatTimestamp';
import padZero from '../utils/padZero';

function formatter({ H, M, S, SS }) {
  return `${padZero(H, 2)}:${padZero(M, 2)}:${padZero(S, 2)}.${padZero(SS, 2) + '0'}`;
}

const NEW_LINE = '\r\n';

export default function generateSrtSubtle(options) {
  const { transcriptData, videoTotalLength } = options;

  const content = transcriptData.reduce((arr, item, idx) => {
    const { start, text } = item;
    const nextItem = transcriptData[idx + 1];
    const end = nextItem ? nextItem.start : videoTotalLength;
    return arr.concat([
      idx + 1,
      `${formatTimestamp(start, formatter)} --> ${formatTimestamp(end, formatter)}`,
      text,
      '',
    ]);
  }, []).join(NEW_LINE).trim() + NEW_LINE;
  const ext = '.srt';

  return { content, ext };
}
