import formatTimestamp from '../utils/formatTimestamp';

const NEW_LINE = '\r\n';

export default function generateSrtSubtle(options) {
  const { transcriptData, videoTotalLength } = options;

  const content = transcriptData.reduce((arr, item, idx) => {
    const { start, text } = item;
    const nextItem = transcriptData[idx + 1];
    const end = nextItem ? nextItem.start : videoTotalLength;
    return arr.concat([
      idx + 1,
      `${formatTimestamp(start)} --> ${formatTimestamp(end)}`,
      text,
      '',
    ]);
  }, []).join(NEW_LINE).trim() + NEW_LINE;
  const ext = '.srt';

  return { content, ext };
}
