/** Change the host sidebar once at the learning boundary; respect manual toggles. */
export function createLearningEntryPolicy(panelId = 'stg-learning') {
  let previous;
  return (activePanelId, wide, alreadyCollapsed = false) => {
    const entered = activePanelId === panelId && previous !== panelId;
    const returnedToChat = (previous === panelId || previous === `${panelId}-sessions`) && activePanelId == null;
    previous = activePanelId;
    // The committed marker is authoritative while the host animates its width.
    return (entered && wide === true && !alreadyCollapsed) || (returnedToChat && alreadyCollapsed);
  };
}
