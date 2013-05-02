/**
*
*  timeValidate 1.0 - 簡易時刻チェック
*  Copyright (c) 2008 IRONHEARTS, Inc.
*
*  http://tech.ironhearts.com/blog/
*
*  Dual licensed under the MIT and GPL licenses:
*  http://www.opensource.org/licenses/mit-license.php
*  http://www.gnu.org/licenses/gpl.html
*
*  @description simple time validate
*
*  usage : ("#time_field").timeValidate();
*
*  入力された時刻が、H:i フォーマットであることをチェック
*
* ("#time_field").timeValidate({maxHour:12,maxMin:60);
*
*  
*
**/

(function($) {

  $.extend({
					 
    timeValidate : new function() {
    
      this.defaults = {	
					required : false,
					maxHour : 24,
					minHour : 0,
					maxMin : 60,
					minMin : 0,
					maxSec : 60,
					minSec : 0,
					useSec : false
      };
      
      this.construct = function(opt) {
				
				var config = $.extend({}, $.timeValidate.defaults, opt);
				var ret = false;
				var target = this.val();
				var result = null;


				// 入力が空だった場合
				if(target == ""){
						if(config.required == true){
							return false;
						}else{
							return true;
						}
				}

				if(config.useSec){
					//
					// 秒を使う
					//
					result = target.match(/^([0-9]{1,2}):([0-9]{1,2}):([0-9]{1,2})$/);
					if(result != null){

						var h = parseInt(result[1],10);
						var m = parseInt(result[2],10);
						var s = parseInt(result[3],10);

						if((config.minHour <= h && h < config.maxHour) &&
							(config.minMin <= m && m < config.maxMin) &&
							(config.minSec <= s && s < config.maxSec)){
			
							ret = true;
						
						}else{
							// format error
						}
					}
				}else{
					// 秒を使わない
					result = target.match(/^([0-9]{1,2}):([0-9]{1,2})$/);

					if(result != null){
						
						var h = parseInt(result[1],10);
						var m = parseInt(result[2],10);
						
						if((config.minHour <= h && h < config.maxHour) &&
							  (config.minMin <= m && m < config.maxMin)){
			
							// OK
							ret = true;
						}else{
							// format error
						}
					}
				}
				
				return ret;

      };
      
    }
  });

  $.fn.extend({
    timeValidate : $.timeValidate.construct
  });

})(jQuery);
