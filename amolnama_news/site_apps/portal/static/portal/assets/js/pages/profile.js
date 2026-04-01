/* Profile page: sync country select → phone code prefix */
(function () {
  var countrySelect = document.getElementById("id_country");
  var codePrefix    = document.getElementById("phone-code-prefix");
  if (!countrySelect || !codePrefix) return;

  function updateCodePrefix() {
    codePrefix.textContent = countrySelect.value || "+880";
  }
  countrySelect.addEventListener("change", updateCodePrefix);
  updateCodePrefix();
})();
