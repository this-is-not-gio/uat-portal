"use client";

import { useState } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function InteractiveNode({ data }: NodeProps) {
	const [count, setCount] = useState(0);

	return (
		<Card className="w-56">
			<Handle type="target" position={Position.Top} />
			<CardHeader>
				<CardTitle>{data.label as string}</CardTitle>
			</CardHeader>
			<CardContent className="flex items-center gap-2">
				<Button
					size="sm"
					onClick={(e) => {
						e.stopPropagation();
						setCount((c) => c + 1);
					}}
				>
					Clicked {count}
				</Button>
			</CardContent>
			<Handle type="source" position={Position.Bottom} />
		</Card>
	);
}
