'use strict';

(function(){
    var ua = navigator.userAgent.toLowerCase();
    if (ua.indexOf('iphone') >= 0 || ua.indexOf('ipod') >= 0) {
        document.write('<link rel="stylesheet" href="css/phone.css">');
    } else if (ua.indexOf('android') >= 0) {
        document.write('<link rel="stylesheet" href="css/phone.css">');
    } else {
        document.write('<link rel="stylesheet" href="css/pc.css">');
    }
})();