"use client";

import { createColumnHelper } from "@tanstack/react-table"
import { type DataTableFeatures } from "./data-table-features"
import { type TestCase } from "@/components/types"
import { Badge } from "../ui/badge";
import { MessageSquare } from "lucide-react";

const columnHelper = createColumnHelper<DataTableFeatures, TestCase>();

export const uatTicketColumns = columnHelper.columns([
	columnHelper.display({
		id: "index",
		cell: (info) => (
			<span className="text-muted-foreground w-fit">{info.row.index + 1}</span>
		),
	}),
	columnHelper.accessor("id", {
		header: "Test Case",
		cell: (info) => (
			<div className="flex flex-col gap-1">
				<div className="flex items-center gap-2">
					<p className="font-medium">{info.row.original.title}</p>
					<div className="text-xs flex flex-row gap-2 items-center">
						<MessageSquare size={12}/>
						<p className="text-xs text-muted-foreground">1</p>
					</div>
				</div>
				<p className="text-xs text-muted-foreground">{info.getValue()}-{info.row.original.section}</p>
			</div>
		),
	}),
	columnHelper.accessor("roleAssignee", {
		header: "Test Actor",
		cell: (info) => (
			<Badge variant="outline" className="w-fit">{info.getValue() || "Not assigned"}</Badge>
		),
	}),
	columnHelper.accessor("stepsToExecute", {
		header: "Total Steps",
		cell: (info) => (
			<Badge variant="outline" className="w-fit">{info.getValue()?.length || 0} {info.row.original.stepsToExecute?.length || 0 > 1 ? "steps" : "step"}</Badge>
		),
	}),
	columnHelper.accessor("lane", {
		header: "Status",
		cell: (info) => {
			const status = info.getValue();
			let colorClass = "";
			switch (status) {
				case "backlog":
					colorClass = "bg-yellow-100 text-yellow-500 bg-yellow-100/10 border-yellow-500";
					break;
				case "pass":
					colorClass = "bg-green-100 text-green-800 bg-green-100 border-green-800";
					break;
				case "fail":
					colorClass = "bg-red-100 text-red-800 bg-red-100 border-red-800";
					break;
				default:
					colorClass = "bg-gray-100 text-gray-800 bg-gray-100 border-gray-800";
			}
			return (
				<Badge className={`w-fit ${colorClass}`}>{status}</Badge>
			);
		},
	}),
	columnHelper.display({
		header: "Last Updated",
		cell: (info) => (
			<p className="text-xs text-muted-foreground">  remarks</p>
		),
	}),
]);

