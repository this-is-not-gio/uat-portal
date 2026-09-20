"use server"

import { createClient } from "@/lib/supabase/server";
import { testStepStatus } from "./test-cases";

// export const PLACEHOLDER_PIC_ID = "efac1d13-b5e3-464a-a4e3-1c4702fc96ed";
// Placeholder "PIC" profile used as the remark author until real login exists.
// See memory: project_placeholder_pic_profile.md (dev project only).
// export async function getPlaceholderPICProfile() {
//     const supabase = await createClient();
//     const { data, error } = await supabase
//         .from("profiles")
//         .select("*")
//         .eq("id", PLACEHOLDER_PIC_ID)
//         .single();

//     if (error) {
//         console.error("Error fetching placeholder PIC profile:", error);
//         throw error;
//     }

//     return data;
// }


export async function setStepResult({ testCaseId, stepId, status }: { testCaseId: string; stepId: string; status: testStepStatus }) {
    const supabase = await createClient();
    const {data, error} = await supabase
        .from("test_steps")
        .update({ status })
        .eq("id", stepId)
        .eq("test_case_id", testCaseId)
        .select("*")
        .single();

    if (error) {
        console.error("Error updating step result:", error);
        throw error;
    }
    console.log("Step result updated:", data);
    return data;
}


export async function addStepRemark({stepId, remark, createdBy }: { stepId: string; remark: string; createdBy: string }) {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from("test_remarks")
        .insert({ test_step_id: stepId,remark: remark, created_by: createdBy })
        .select("*, profile:profiles(full_name)")
        .single();

    if (error) {
        console.error("Error adding step remark:", error);
        throw error;
    }
    console.log("Step remark added:", data);
    return data;
}
