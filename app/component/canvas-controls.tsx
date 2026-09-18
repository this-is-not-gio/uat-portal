"use client";

import { Panel, useReactFlow } from "@xyflow/react";
import { Maximize, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CanvasControls() {
	const { zoomIn, zoomOut, fitView } = useReactFlow();

	return (
		<Panel position="bottom-left">
			<div className="flex gap-1 rounded-lg border border-border bg-background p-1 shadow-sm">
				<Button variant="outline" size="icon-sm" onClick={() => zoomIn()}>
					<ZoomIn />
				</Button>
				<Button variant="outline" size="icon-sm" onClick={() => zoomOut()}>
					<ZoomOut />
				</Button>
				<Button variant="outline" size="icon-sm" onClick={() => fitView()}>
					<Maximize />
				</Button>
			</div>
		</Panel>
	);
}   
