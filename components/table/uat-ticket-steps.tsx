"use client";

import { createColumnHelper } from "@tanstack/react-table"
import { type DataTableFeatures } from "./data-table-features"
import { type TestCase } from "@/components/types"

const columnHelper = createColumnHelper<DataTableFeatures, TestCase>();

export const uatTicketSteps = columnHelper.columns([
	columnHelper.accessor("title", {
		header: "Title",
	}),
	columnHelper.accessor("description", {
		header: "Description",
	}),
	columnHelper.accessor("priority", {
		header: "Priority",
	}),
	columnHelper.accessor("roleAssignee", {
		header: "Assignee",
	}),
])

