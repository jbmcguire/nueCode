/**
 * nueCode Console Bridge
 *
 * Add this script to your dev server's HTML to capture console output
 * in the nueCode browser panel.
 *
 * Usage: <script src="http://localhost:YOUR_T3_PORT/console-bridge.js"></script>
 */
(function () {
  "use strict";

  if (window.__t3ConsoleBridgeInstalled) return;
  window.__t3ConsoleBridgeInstalled = true;

  var SOURCE = "nuecode-console-bridge";
  var LEVELS = ["log", "info", "warn", "error", "debug"];
  var MAX_ARG_LENGTH = 2048;

  function serialize(value) {
    if (value === undefined) return "undefined";
    if (value === null) return "null";
    if (value instanceof Error) {
      return value.stack || value.message || String(value);
    }
    if (typeof value === "object") {
      try {
        return JSON.stringify(value, null, 2).slice(0, MAX_ARG_LENGTH);
      } catch (_e) {
        return String(value);
      }
    }
    return String(value).slice(0, MAX_ARG_LENGTH);
  }

  function send(type, level, args) {
    try {
      window.parent.postMessage(
        {
          source: SOURCE,
          type: type,
          level: level,
          args: Array.prototype.map.call(args, serialize),
          timestamp: Date.now(),
          url: location.href,
        },
        "*",
      );
    } catch (_e) {
      // Silently fail if postMessage is blocked
    }
  }

  // Wrap console methods
  LEVELS.forEach(function (level) {
    var original = console[level];
    if (!original) return;

    console[level] = function () {
      send("console", level, arguments);
      return original.apply(console, arguments);
    };
  });

  // Capture unhandled errors
  window.addEventListener("error", function (event) {
    send("error", "error", [
      event.message || "Unhandled error",
      event.filename ? event.filename + ":" + event.lineno + ":" + event.colno : "",
    ]);
  });

  // Capture unhandled promise rejections
  window.addEventListener("unhandledrejection", function (event) {
    send("error", "error", ["Unhandled promise rejection: " + serialize(event.reason)]);
  });

  // Notify parent of navigation events
  var lastUrl = location.href;
  function checkNavigation() {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      try {
        window.parent.postMessage({ source: SOURCE, type: "navigation", url: lastUrl }, "*");
      } catch (_e) {}
    }
  }

  // Use both pushState/replaceState wrapping and popstate for SPA navigation detection
  var originalPushState = history.pushState;
  var originalReplaceState = history.replaceState;

  history.pushState = function () {
    originalPushState.apply(this, arguments);
    checkNavigation();
  };

  history.replaceState = function () {
    originalReplaceState.apply(this, arguments);
    checkNavigation();
  };

  window.addEventListener("popstate", checkNavigation);
})();
