"use client";

import { useCallback } from "react";
import {
  Background,
  BackgroundVariant,
  ReactFlow,
  addEdge,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { CardNode } from "./card-node";
import { InteractiveNode } from "./interactive-node";
import { CanvasControls } from "./canvas-controls";

const nodeTypes: NodeTypes = {
  card: CardNode,
  interactive: InteractiveNode,
};

const initialNodes: Node[] = [
  {
    id: "1",
    position: { x: 0, y: 0 },
    data: { label: "default node (no `type` set)" },
  },
  {
    id: "2",
    type: "card",
    position: { x: 300, y: 0 },
    data: { label: "card node" },
  },
  {
    id: "3",
    type: "interactive",
    position: { x: 300, y: 200 },
    data: { label: "interactive node" },
  },
];

const initialEdges: Edge[] = [];

export default function Page() {
  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onConnect = useCallback(
    (connection: Connection) => setEdges((eds) => addEdge(connection, eds)),
    [setEdges]
  );

  return (
    <div className="flex flex-1 h-full flex-colwhat border-2 border-border rounded-2xl bg-white drop-shadow-xs">
      <div className="flex-1 rounded-lg overflow-hidden">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          fitView
        >
          <Background variant={BackgroundVariant.Dots} />
          <CanvasControls />
        </ReactFlow>
      </div>
    </div>
  );
}
