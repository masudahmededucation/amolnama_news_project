document.addEventListener("DOMContentLoaded", function () {
  var toggle = document.querySelector(".header-user-menu-toggle");
  if (!toggle) return;

  var dropdown = toggle.nextElementSibling;

  toggle.addEventListener("click", function (e) {
    e.stopPropagation();
    var expanded = toggle.getAttribute("aria-expanded") === "true";
    toggle.setAttribute("aria-expanded", String(!expanded));
    dropdown.classList.toggle("open");
  });

  document.addEventListener("click", function () {
    toggle.setAttribute("aria-expanded", "false");
    dropdown.classList.remove("open");
  });
});
