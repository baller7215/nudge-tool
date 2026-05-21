const CLOSE_NUDGE_REGEX = /closes?\s+nudge\s+#?([a-zA-Z]\d+)/gi;

export const normalizeNudgeDisplayId = (value = "") =>
  String(value).replace(/^#/, "").trim().toUpperCase();

/** @returns {string[]} unique display IDs in document order */
export const parseCloseNudgeCommands = (text = "") => {
  const found = [];
  const seen = new Set();
  const source = String(text || "");
  let match = CLOSE_NUDGE_REGEX.exec(source);
  while (match) {
    const id = normalizeNudgeDisplayId(match[1]);
    if (id && !seen.has(id)) {
      seen.add(id);
      found.push(id);
    }
    match = CLOSE_NUDGE_REGEX.exec(source);
  }
  return found;
};
