import { Line } from 'react-konva';
import type { CanvasMagnetGuide } from './canvasMagnetGuides';

interface CanvasDragGuideProps {
  guides: CanvasMagnetGuide[];
}

export function CanvasDragGuide({ guides }: CanvasDragGuideProps) {
  return (
    <>
      {guides.map((guide) => (
        <Line
          dash={guide.kind === 'line' ? [2, 7] : [6, 4]}
          key={`${guide.id}-primary`}
          listening={false}
          name={`magnet-guide-${guide.kind}-${guide.orientation}`}
          opacity={0.78}
          points={[guide.x1, guide.y1, guide.x2, guide.y2]}
          shadowBlur={10}
          shadowColor="#37FD76"
          stroke="#37FD76"
          strokeWidth={guide.kind === 'line' ? 1 : 2}
        />
      ))}
      {guides.map((guide) =>
        guide.kind === 'size' ? (
          <Line
            dash={[6, 4]}
            key={`${guide.id}-cap`}
            listening={false}
            name={`magnet-guide-size-cap-${guide.orientation}`}
            opacity={0.78}
            points={[guide.capX1, guide.capY1, guide.capX2, guide.capY2]}
            shadowBlur={10}
            shadowColor="#37FD76"
            stroke="#37FD76"
            strokeWidth={2}
          />
        ) : null,
      )}
    </>
  );
}
