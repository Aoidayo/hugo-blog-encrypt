(function () {
  "use strict";

  var encoder = new TextEncoder();
  var decoder = new TextDecoder();

  function bytesFromBase64(value) {
    var binary = atob(value);
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  function readStoredPassword(key) {
    try {
      return sessionStorage.getItem("hugo-encrypt:" + key) || "";
    } catch (error) {
      return "";
    }
  }

  function storePassword(key, password) {
    try {
      sessionStorage.setItem("hugo-encrypt:" + key, password);
    } catch (error) {
      // Ignore private browsing and disabled storage.
    }
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (char) {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      }[char];
    });
  }

  async function decrypt(payload, password) {
    var keyMaterial = await crypto.subtle.importKey(
      "raw",
      encoder.encode(password),
      "PBKDF2",
      false,
      ["deriveKey"]
    );
    var key = await crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        hash: "SHA-256",
        salt: bytesFromBase64(payload.salt),
        iterations: payload.iterations
      },
      keyMaterial,
      { name: "AES-GCM", length: 256 },
      false,
      ["decrypt"]
    );
    var plaintext = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: bytesFromBase64(payload.iv)
      },
      key,
      bytesFromBase64(payload.ciphertext)
    );
    return decoder.decode(plaintext);
  }

  function unlockBox(box, payload, password) {
    return decrypt(payload, password).then(function (html) {
      storePassword(payload.id, password);
      box.innerHTML = html;
      box.classList.remove("hugo-encrypt-box", "hugo-encrypt-pending");
      box.classList.add("hugo-encrypt-unlocked");
    });
  }

  function createForm(box, payload) {
    var savedPassword = readStoredPassword(payload.id);
    if (savedPassword) {
      box.classList.add("hugo-encrypt-pending");
      box.textContent = "正在解密...";
      unlockBox(box, payload, savedPassword).catch(function () {
        box.classList.remove("hugo-encrypt-pending");
        renderPasswordForm(box, payload, savedPassword);
      });
      return;
    }

    renderPasswordForm(box, payload, "");
  }

  function renderPasswordForm(box, payload, initialPassword) {
    var form = document.createElement("form");
    form.className = "hugo-encrypt-form";
    form.innerHTML = [
      '<div class="hugo-encrypt-lock" aria-hidden="true">LOCK</div>',
      '<label class="hugo-encrypt-label" for="' + payload.id + '-password">' + escapeHtml(payload.prompt) + "</label>",
      '<div class="hugo-encrypt-row">',
      '<input id="' + payload.id + '-password" class="hugo-encrypt-input" type="password" autocomplete="current-password">',
      '<button class="hugo-encrypt-button" type="submit">解锁</button>',
      "</div>",
      '<p class="hugo-encrypt-message" role="status" aria-live="polite"></p>'
    ].join("");

    var input = form.querySelector("input");
    var message = form.querySelector(".hugo-encrypt-message");
    input.value = initialPassword || "";

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      message.textContent = "正在解密...";
      unlockBox(box, payload, input.value).catch(function () {
        message.textContent = "密码错误或内容已损坏。";
        input.select();
      });
    });

    box.replaceChildren(form);
  }

  function init() {
    if (!window.crypto || !window.crypto.subtle) {
      document.querySelectorAll("[data-hugo-encrypt]").forEach(function (box) {
        box.textContent = "当前浏览器不支持 Web Crypto，无法解密。";
      });
      return;
    }

    document.querySelectorAll("[data-hugo-encrypt]").forEach(function (box) {
      var payload;
      try {
        payload = JSON.parse(box.querySelector("script").textContent);
      } catch (error) {
        box.textContent = "加密数据读取失败。";
        return;
      }
      createForm(box, payload);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
