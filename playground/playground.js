/**
 * The JSON-LD playground is used to test out JavaScript Object Notation 
 * for Linked Data.
 *
 * @author Manu Sporny <msporny@digitalbazaar.com>
 */
(function($)
{
   // create the playground instance if it doesn't already exist
   window.playground = window.playground || {};
   var playground = window.playground;
   
   // set the active tab to the compacted view
   playground.activeTab = "tab-compacted";
   
   // the counter is used to throttle colorization requests in milliseconds
   playground.colorizeDelay = 500;
   
   // the colorize timeout is used to keep track of the timeout object of the
   // colorize delay
   playground.colorizeTimeout = null;
   
   /**
    * Escapes text that will affect HTML markup.
    *
    * @param text the string to re-encode as HTML.
    */
   playground.htmlEscape = function(text) 
   {
      // replace each special HTML character in the string
      return text.replace(/([&<>])/g, function (c) {
         return "&" + {
             "&": "amp",
             "<": "lt",
             ">": "gt"
         }[c] + ";";
      });
   };


   /**
    * Get a query parameter by name.
    *
    * Code from:
    * http://stackoverflow.com/questions/901115/get-query-string-values-in-javascript/5158301#5158301
    *
    * @param name a query parameter name.
    *
    * @return the value of the parameter or null if it does not exist
    */
   function getParameterByName(name) {
      var match = RegExp('[?&]' + name + '=([^&]*)')
         .exec(window.location.search);
      return match && decodeURIComponent(match[1].replace(/\+/g, ' '));
   };

   /**
    * Handle URL query parameters.
    *
    * Checks "json-ld" and "frame" parameters.  If they look like JSON then
    * interpret as JSON strings else interpret as URLs of remote resources.
    * Note: URLs must be CORS enabled to load due to browser same origin policy
    * issues.
    */
   playground.processQueryParameters = function()
   {
      // data from the query
      var queryData = {
         markup: null,
         frame: null
      };

      /**
       * Read a parameter as JSON or created an jQuery AJAX Deferred call
       * to read the data.
       *
       * @param param a query parameter value.
       * @param fieldName the field name to populate in queryData object.
       * @param msgName the param name to use in UI messages.
       *
       * @return jQuery Deferred or null
       */
      function handleParameter(param, fieldName, msgName)
      {
         // the ajax deferred or null
         var rval = null;

         // check "json-ld" parameter
         if(param !== null)
         {
            hasQueryData = true;
            if(param.length == 0 || param[0] == "{" || param[0] == "[")
            {
               // param looks like JSON
               queryData[fieldName] = param;
            }
            else
            {
               // treat param as a URL
               rval = $.ajax({
                  url: param,
                  dataType: 'text',
                  success: function(data, textStatus, jqXHR) {
                     queryData[fieldName] = data;
                  },
                  error: function(jqXHR, textStatus, errorThrown) {
                     // FIXME: better error handling
                     $("#markup-errors")
                        .text("Error loading " + msgName + " URL: " + param);
                  }
               });
            }
         };

         return rval;
      };

      // build deferreds
      var jsonLdDeferred = handleParameter(
         getParameterByName("json-ld"), "markup", "JSON-LD");
      var frameDeferred = handleParameter(
         getParameterByName("frame"), "frame", "frame");

      // wait for ajax if needed
      // failures handled in AJAX calls
      $.when(jsonLdDeferred, frameDeferred)
         .done(function() {
            // populate UI with data
            playground.populateWithJSON(queryData);
         });
   };

   /**
    * Used to initialize the UI, call once on document load.
    */
   playground.init = function()
   {
      $("#tabs").tabs();
      $("#frame").hide();
      $("#tabs").bind("tabsselect", playground.tabSelected);
      playground.processQueryParameters();
   };

   /**
    * Callback for when tabs are selected in the UI.
    *
    * @param event the event that fired when the tab was selected.
    * @param ui the ui tab object that was selected
    */
   playground.tabSelected = function(event, ui)
   {
      playground.activeTab = ui.tab.id;
      if(ui.tab.id == "tab-framed")
      {
         // if the 'frame' tab is selected, display the frame input textarea
         $("#markup").addClass("compressed");
         $("#frame").show();
      }
      else
      {
         // if the 'frame' tab is not selected, hide the frame input area
         $("#frame").hide();
         $("#markup").removeClass("compressed");
      }
      
      // perform processing on the data provided in the input boxes
      playground.process();
      
      // apply the syntax colorization
      prettyPrint();
   };

   /**
    * Process the JSON-LD markup that has been input and display the output
    * in the active tab.
    */
   playground.process = function()
   {
      var input = null;
      var frame = null;
      var errors = false;

      // check to see if the JSON-LD markup is valid JSON
      try
      {
         $("#markup-errors").text("");
         input = JSON.parse($("#markup").val());
      }
      catch(e)
      {
         $("#markup-errors").text("JSON markup - " + e);
         errors = true;
      }

      // check to see if the JSON-LD frame is valid JSON
      try
      {
         $("#frame-errors").text("");
         frame = JSON.parse($("#frame").val());
      }
      catch(e)
      {
         $("#frame-errors").text("JSON-LD frame - " + e);
         errors = true;
      }

      // if there are no errors, perform the action and display the output
      if(!errors)
      {
         if(playground.activeTab == "tab-normalized")
         {
            var normalized = forge.jsonld.normalize(input);
            $("#normalized").html(js_beautify(JSON.stringify(normalized)),
               { "indent_size": 3, "brace_style": "expand" });
         }
         else if(playground.activeTab == "tab-expanded")
         {
            var expanded = forge.jsonld.expand(input);
            $("#expanded").html(js_beautify(JSON.stringify(expanded)),
               { "indent_size": 3, "brace_style": "expand" });
         }
         else if(playground.activeTab == "tab-compacted")
         {
            var compacted = forge.jsonld.compact(
               input["@context"] || {}, input);
            $("#compacted").html(js_beautify(JSON.stringify(compacted)),
               { "indent_size": 3, "brace_style": "expand" });
         }
         else if(playground.activeTab == "tab-framed")
         {
            var framed = forge.jsonld.frame(input, frame);
            $("#framed").html(js_beautify(JSON.stringify(framed)),
               { "indent_size": 3, "brace_style": "expand" });
         }
         else if(playground.activeTab == "tab-turtle")
         {
            var turtle = forge.jsonld.turtle(input);
            $("#turtle").html(playground.htmlEscape(turtle));
         }

         // generate a link for current data
         var link = "?json-ld=" + encodeURIComponent(JSON.stringify(input));
         if($("#frame").val().length > 0)
         {
            link += "&frame=" + encodeURIComponent(JSON.stringify(frame));
         }
         var permalink = '<a href="' + link + '">permalink</a>';
         // size warning for huge links
         if((window.location.protocol.length + 2 +
            window.location.host.length + window.location.pathname.length +
            link.length) > 2048)
         {
            permalink += " (2KB+)"
         }
         $("#permalink")
            .html(permalink)
            .show();
      }
      else
      {
         $("#permalink").hide();
      }
      
      // Start the colorization delay
      playground.checkColorizeDelay(true);
   }

   /**
    * Performs a check on the colorize delay. If the delay hits 0, the
    * markup is colorized.
    *
    * @param reset true if the colorization timeout should be reset
    */
   playground.checkColorizeDelay = function(reset)
   {
      // if the counter reset flag is set, reset the counter
      if(reset)
      {
         playground.colorizeDelay = 500;
      }
      else
      {
         playground.colorizeDelay -= 250;
      }
      
      if(playground.colorizeDelay <= 0)
      {
         // if the delay has expired, perform colorization
         prettyPrint();
      }
      else
      {
         // if the delay has not expired, continue counting down
         if(playground.colorizeTimeout)
         {
            clearTimeout(playground.colorizeTimeout);
         }
         playground.colorizeTimeout = 
            setTimeout(playground.checkColorizeDelay, 250);
      }
   };

   /**
    * Populate the UI with markup and frame JSON. The data parameter should
    * have a 'markup' field and optional 'frame' field that contain a
    * serialized JSON string.
    *
    * @param data object with optional 'markup' and 'frame' fields.
    */
   playground.populateWithJSON = function(data)
   {
      var hasData = false;

      if('markup' in data && data.markup !== null)
      {
         hasData = true;
         // fill the markup box with the example
         $("#markup").val(js_beautify(
            data.markup,
            { "indent_size": 3, "brace_style": "expand" }));
      }

      if('frame' in data && data.frame !== null)
      {
         hasData = true;
         // fill the frame input box with the example frame
         $("#frame").val(js_beautify(
            data.frame,
            { "indent_size": 3, "brace_style": "expand" }));
      }
      else
      {
         $("#frame").val("{}");
      }

      if(hasData)
      {
         // perform processing on the data provided in the input boxes
         playground.process();

         // apply the syntax colorization
         prettyPrint();
      }
   };

   /**
    * Populate the UI with a named example.
    *
    * @param name the name of the example to pre-populate the input boxes.
    */
   playground.populateWithExample = function(name)
   {
      var data = {
         markup: null,
         frame: null
      };

      if(name in playground.examples)
      {
         // fill the markup with the example
         data.markup = JSON.stringify(playground.examples[name]);

         if(name in playground.frames)
         {
            // fill the frame with the example frame
            data.frame = JSON.stringify(playground.frames[name]);
         }
      }

      // populate with the example
      playground.populateWithJSON(data);
   };

})(jQuery);

