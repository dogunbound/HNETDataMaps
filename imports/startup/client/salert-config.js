import { sAlert } from 'meteor/juliancwirko:s-alert';


Meteor.startup(function () {
  sAlert.config({
    effect: '',
    position: 'top-right',
    timeout: 8000,
    html: false,
    onRouteClose: true,
    stack: true,
    // or you can pass an object:
    // stack: {
    //     spacing: 10 // in px
    //     limit: 3 // when fourth alert appears all previous ones are cleared
    // }
    offset: 50, // in px - will be added to first alert (bottom or top - depends of the position in config)
    beep: false,
    // examples:
    // beep: '/beep.mp3'  // or you can pass an object:
    // beep: {
    //     info: '/beep-info.mp3',
    //     error: '/beep-error.mp3',
    //     success: '/beep-success.mp3',
    //     warning: '/beep-warning.mp3'
    // }
    onClose: _.noop
    // examples:
    // onClose: function() {
    //     /* Code here will be executed once the alert closes. */
    // }
  });
});
