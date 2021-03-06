(function (root, factory) {
  // AMD
  if (typeof define === 'function' && define.amd) define(['angular', 'underscore'], factory);
  // Global
  else factory(angular, _);
}(this, function (angular, _) {

  angular
  .module('ckeditor', [])
  .provider('ckeditorSettings', function() {
    this.settings = {};
    this.$get = function() { return this.settings; };
    this.set = function(newSettings) {
      _.extend(this.settings, newSettings);
    };
  })
  .directive('ckeditor', ['$parse', ckeditorDirective]);

  // Create setImmediate function.
  var setImmediate = window && window.setImmediate ? window.setImmediate : function (fn) {
    setTimeout(fn, 0);
  };

  /**
   * CKEditor directive.
   *
   * @example
   * <div ckeditor="options" ng-model="content" ready="onReady()"></div>
   */

  function ckeditorDirective($parse) {
    return {
      restrict: 'A',
      require: ['ckeditor', 'ngModel'],
      controller: [
        '$scope',
        '$element',
        '$attrs',
        '$parse',
        '$q',
        'ckeditorSettings',
        ckeditorController
      ],
      link: function (scope, element, attrs, ctrls) {
        var ckeditor = ctrls[0];
        var ngModel = ctrls[1];

        // Initialize the editor when it is ready.
        ckeditor.ready().then(function initialize() {
          // Sync view on specific events.
          ['dataReady', 'key', 'change', 'saveSnapshot'].forEach(function (event) {
            ckeditor.$on(event, function syncView() {
              ngModel.$setViewValue(ckeditor.instance.getData() || '');
            });
          });

          // Put editor out of readonly.
          ckeditor.instance.setReadOnly(false);

          // Defer the ready handler calling to ensure that the editor is
          // completely ready and populated with data.
          setImmediate(function () {
            $parse(attrs.ready)(scope);
          });
        });

        // Set editor data when view data change.
        ngModel.$render = function syncEditor() {
          ckeditor.ready().then(function () {
            ckeditor.instance.setData(ngModel.$viewValue || '');
          });
        };
      }
    };
  }

  /**
   * CKEditor controller.
   */

  function ckeditorController($scope, $element, $attrs, $parse, $q, ckeditorSettings) {
    // Create editor instance.
    var config = $parse($attrs.ckeditor)($scope) || {};
    config = _.defaults({}, config, ckeditorSettings);
    var editorElement = $element[0];
    var instance;
    if ((editorElement.hasAttribute('contenteditable') &&
        editorElement.getAttribute('contenteditable').toLowerCase() == 'true') || config.inline) {
      instance = this.instance = CKEDITOR.inline(editorElement, config);
    }
    else {
      instance = this.instance = CKEDITOR.replace(editorElement, config);
    }
    if (config.instance) {
      $scope.$eval(config.instance + ' = i', {i: instance});
    }
    if (config.focused) {
      instance.on('focus', function() {
        $scope.$apply(function() {
          $scope.$eval(config.focused + ' = true');
        });
      });
      instance.on('blur', function() {
        $scope.$apply(function() {
          $scope.$eval(config.focused + ' = false');
        });
      });
    }

    /**
     * Listen on events of a given type.
     * This make all event asynchrone and wrapped in $scope.$apply.
     *
     * @param {String} event
     * @param {Function} listener
     * @returns {Function} Deregistration function for this listener.
     */

    this.$on = function $on(event, listener) {
      // Wrap primus event with $rootScope.$apply.
      instance.on(event, asyncListener);

      function asyncListener() {
        var args = arguments;
        setImmediate(function () {
          applyListener.apply(null, args);
        });
      }

      function applyListener() {
        var args = arguments;
        $scope.$apply(function () {
          listener.apply(null, args);
        });
      }

      // Return the deregistration function
      return function $off() {
        instance.removeListener(event, applyListener);
      };
    };

    /**
     * Check if the editor if ready.
     *
     * @returns {Promise}
     */

    this.ready = function ready() {
      if (this.readyDefer) return this.readyDefer.promise;

      var readyDefer = this.readyDefer = $q.defer();
      if (this.instance.status === 'ready') readyDefer.resolve();
      else this.$on('instanceReady', readyDefer.resolve);

      return readyDefer.promise;
    };

    // Destroy editor when the scope is destroyed.
    $scope.$on('$destroy', function onDestroy() {
      try {
        instance.destroy(false);
      } catch (e) {}
    });
  }
}));
