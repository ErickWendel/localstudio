import { Line } from 'react-konva';

interface CanvasDragGuideProps {
  guide: { x: number; y: number };
  stageHeight: number;
  stageWidth: number;
}

export function CanvasDragGuide({ guide, stageHeight, stageWidth }: CanvasDragGuideProps) {
  return (
    <>
      <Line
        listening={false}
        points={[guide.x, 0, guide.x, stageHeight]}
        stroke="#37FD76"
        strokeWidth={1}
        opacity={0.78}
        dash={[2, 7]}
        shadowBlur={10}
        shadowColor="#37FD76"
      />
      <Line
        listening={false}
        points={[0, guide.y, stageWidth, guide.y]}
        stroke="#37FD76"
        strokeWidth={1}
        opacity={0.78}
        dash={[2, 7]}
        shadowBlur={10}
        shadowColor="#37FD76"
      />
    </>
  );
}
