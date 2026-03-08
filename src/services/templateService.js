// Simple in-memory template store (replace with DB later)
const templates = new Map();

// Example template
templates.set('registration_confirmation:v1', {
  render: (vars) => `Hello ${vars.name}, you are registered for ${vars.event}.`
});

function renderTemplate(templateId, templateVersion, vars = {}) {
  if (!templateId) return null;
  const key = `${templateId}:${templateVersion || 'v1'}`;
  const tpl = templates.get(key);
  if (!tpl) throw new Error(`Template not found: ${key}`);
  return tpl.render(vars);
}

// Render a row-based ad-hoc template with placeholders.
// Supported placeholders:
//   {{1}} numeric position (1-based index into row array)
//   {{headerName}} using provided headers array (case-insensitive match)
// Unknown placeholders are replaced with empty string.
// headers: ["email", "name", ...]
// row: ["user@x.com", "Alice", ...]
function renderRowTemplate(template, headers, row) {
  if (!template || !Array.isArray(headers) || !Array.isArray(row)) return '';
  const headerMap = new Map();
  headers.forEach((h, idx) => headerMap.set(String(h).toLowerCase(), idx));
  return template.replace(/{{\s*([^}]+?)\s*}}/g, (m, token) => {
    const key = String(token).trim();
    if (/^\d+$/.test(key)) {
      const pos = parseInt(key, 10) - 1;
      return row[pos] !== undefined ? String(row[pos]) : '';
    }
    const idx = headerMap.get(key.toLowerCase());
    if (idx !== undefined) return row[idx] !== undefined ? String(row[idx]) : '';
    return '';
  });
}

module.exports = { renderTemplate, renderRowTemplate };
