export type SuggestTaskPromptsInput = {
  client: string;
  location: string;
};

/**
 * Stub implementation of suggestTaskPrompts.
 * Replace with actual AI integration as needed.
 */
export async function suggestTaskPrompts(
  input: SuggestTaskPromptsInput
): Promise<{ suggestedTasks: string[] }> {
  // TODO: Implement AI call to generate suggestions based on client and location
  // This is a placeholder returning an empty list
  return { suggestedTasks: [] };
}