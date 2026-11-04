// One-time clean-up of the saved site data: removes the demo cars that were added in version 1
// (6 premium cars + 15 sold cars). Runs once; cars the owner adds later with the same ids are not touched again.
export const SEED_VERSION = 2;
export const REMOVE_IDS = ["v44", "v45", "v46", "v47", "v48", "v49", ...Array.from({ length: 15 }, (_, i) => "s" + String(i + 1).padStart(2, "0"))];
