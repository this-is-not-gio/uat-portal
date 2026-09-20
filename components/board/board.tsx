"use client";

import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import {
  DndContext,
  DragOverlay,
  MeasuringStrategy,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { Swimlane } from "./swimlane";
import { TestCaseCard } from "./test-case-card";
import { LANES, type testCaseStatus, type TestCase } from "@/components/types";

function isLaneId(id: string): id is testCaseStatus {
  return LANES.some((lane) => lane.id === id);
}

export function Board({
  testCases,
  setTestCases,
}: {
  testCases: TestCase[];
  setTestCases: Dispatch<SetStateAction<TestCase[]>>;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  );

  const lanesWithCases = useMemo(
    () =>
      LANES.map((lane) => ({
        ...lane,
        testCases: testCases
          .filter((testCase) => testCase.status === lane.id)
          .sort((a, b) => a.order - b.order),
      })),
    [testCases]
  );

  const activeTestCase = testCases.find((testCase) => testCase.id === activeId);

  function laneOf(id: string): testCaseStatus | undefined {
    if (isLaneId(id)) return id;
    return testCases.find((testCase) => testCase.id === id)?.status;
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;

    const activeLane = laneOf(String(active.id));
    const overLane = laneOf(String(over.id));
    if (!activeLane || !overLane || activeLane === overLane) return;

    setTestCases((current) => {
      const overCasesInLane = current
        .filter((testCase) => testCase.status === overLane)
        .sort((a, b) => a.order - b.order);
      const overIndex = overCasesInLane.findIndex((testCase) => testCase.id === over.id);
      const insertAt = overIndex === -1 ? overCasesInLane.length : overIndex;

      return current.map((testCase) => {
        if (testCase.id !== active.id) return testCase;
        return { ...testCase, status: overLane, order: insertAt - 0.5 };
      });
    });
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const lane = laneOf(String(active.id));
    if (!lane) return;

    setTestCases((current) => {
      const laneCases = current
        .filter((testCase) => testCase.status === lane)
        .sort((a, b) => a.order - b.order);
      const otherCases = current.filter((testCase) => testCase.status !== lane);

      const fromIndex = laneCases.findIndex((testCase) => testCase.id === active.id);
      const overCardIndex = laneCases.findIndex((testCase) => testCase.id === over.id);
      const toIndex = overCardIndex === -1 ? laneCases.length - 1 : overCardIndex;

      const reordered =
        fromIndex === -1 ? laneCases : arrayMove(laneCases, fromIndex, toIndex);

      return [
        ...otherCases,
        ...reordered.map((testCase, index) => ({ ...testCase, order: index })),
      ];
    });
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex min-h-0 flex-1 gap-4">
        {lanesWithCases.map((lane) => (
          <Swimlane key={lane.id} id={lane.id} title={lane.title} testCases={lane.testCases} />
        ))}
      </div>
      <DragOverlay>
        {activeTestCase ? <TestCaseCard testCase={activeTestCase} /> : null}
      </DragOverlay>
    </DndContext>
  );
}
