function normalizeUID(uid) {
  if (!uid) return '';
  return uid.replace(/\s/g, '').toUpperCase();
}
module.exports = { normalizeUID };
