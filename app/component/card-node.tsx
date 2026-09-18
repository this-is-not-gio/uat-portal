import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export function CardNode({ data }: NodeProps) {
  return (
    <Card className="w-56">
      <Handle type="target" position={Position.Top} />
      <CardHeader>
        <CardTitle>{data.label as string}</CardTitle>
      </CardHeader>
      <CardContent>
        Fully custom node — this is just the shadcn Card component.
      </CardContent>
      <Handle type="source" position={Position.Bottom} />
    </Card>
  );
}
