var express = require('express');
var router = express.Router();
var superagent = require('superagent');
var cheerio = require('cheerio');
var mongoose = require('mongoose');
// var crawl = require('./crawl.js');
var config = require('./config.js');
var db = mongoose.connect('mongodb://localhost/same');
// 创建视图
var Schema = mongoose.Schema;
var Users = new Schema({
	id: Number,
	name: String
});
var Channels = new Schema({
	id: Number,
	name: String
});
// 注册model
mongoose.model('user',Users);
mongoose.model('channel',Channels);
// 创建模型
var User = mongoose.model('user'),
	Channel = mongoose.model('channel');

var Crawl={
	User_id : [{id:940}],
	User_hash : {},
	Channel_id : [{id: 1399757}],
	Channel_hash : {},
	host : "http://v2.same.com",
	crawl_user : function(callback){
		var self = this;console.log(self.Channel_id);
		var obj = self.Channel_id.shift();
		var url;var result;
		if (!obj) {console.log("用户数量和用户心情已经被爬完..."); return ;}
		if (obj.next){
			url = self.host + obj.next;
		}else{
			url = self.host + '/user/' + obj.id + '/senses';
		}
		superagent.get(url)
				  .set(config.header)
				  .end(function(err,res){
				  	if (err) {console.log(err);}
				  	res.text = JSON.parse(res.text);
				  	var data = res.text.data;
				  	if (data.next){
				  		//推入channel_id队列中 下次继续爬
				  		self.Channel_id.push({
				  			id: obj.id,
				  			next: data.next
				  		});
				  	}
				  	//对数据库和队列操作
				  	//爬完后存入hash
				  	self.Channel_hash[obj.id] = true;
				  	//与hash对比去重
				  	var arr = [];var tmp;
				  	for (var i = 0; i< data.results.length;i++){
				  		tmp = data.results[i].user.id
				  		if( !self.User_hash[tmp]){
				  			arr.push({id : tmp});
				  			self.User_id.push({id : tmp});
				  		}
				  	}
				  	//数据库操作
				  	User.create(arr,function(err,result){
				  		if (err){ console.log(err)}
				  		 // self.crawl_user();
				  	});
				  });;

	}
};
/* GET home page. */
router.get('/', function(req, res, next) {
	console.log('开始爬取same...');
	//从第一个userId开始爬channel
	Crawl.crawl_user();
  	console.log('运行完了');
});



// function crawlUser(id){

// }



// function user_call(error,res){
// 	//错误 就返回
// 	if (error){
// 		console.log(error);
// 		return ;
// 	}
// 	res = JSON.parse(res);
// 	var data = res.data;
// 	var results = data.results;
// 	var item;
// 	//批量提交到mongodb 节省时间
// 	var user_list = []; 
// 	var user;
// 	//如果返回data中有next字段 再次存入channelid队列中 等待下次继续爬取
// 	if (data.next){
// 		Channel_id.push({
// 			id: crawl_user.id,
// 			next: data.next
// 		})
// 	}
// 	for (var i =0;i<results.length;i++){
// 		item = results[i].user;
// 		//如果hash中没有
// 		if (!User_hash['item.id']){
// 			user = {
// 				id: item.id,
// 				username: item.username
// 			};
// 			user_list.push(user);
// 			//需要爬的userid队列
// 			User_id.push(user.id);
// 		}
// 	}
// 	//批量存入user
// 	User.create(user_list,function(err,results){
// 		if (error){
// 			console.log(error);
// 			return;
// 		}
// 		//从Channel_id中取出
// 		var next_channel_id = Channel_id.shift();
// 		if(!next_channel_id) {console.log("频道id爬完了,也就是说没用户id增加了!") return ;}
// 		return crawl.user(next_channel_id,user_call);
// 	});
// }

// function channel_call(error,res){

// 	//错误 就返回
// 	if (error){
// 		console.log(error);
// 		return ;
// 	}
// 	res = JSON.parse(res);
// 	var data = res.data;
// 	var results = data['writed_channels'];
// 	var item;
// 	//批量提交到mongodb 节省时间
// 	var channel_list = []; 
// 	var channel;
// 	//如果返回data中有next字段 再次存入channelid队列中 等待下次继续爬取
// 	if (data.next){
// 		Channel_id.push({
// 			id: crawl_user.id,
// 			next: data.next
// 		})
// 	}
// 	for (var i =0;i<results.length;i++){
// 		item = results[i].user;
// 		//如果hash中没有
// 		if (!User_hash['item.id']){
// 			user = {
// 				id: item.id,
// 				username: item.username
// 			};
// 			user_list.push(user);
// 			//需要爬的userid队列
// 			User_id.push(user.id);
// 		}
// 	}
// 	//批量存入user
// 	User.create(user_list,function(err,results){
// 		if (error){
// 			console.log(error);
// 			return;
// 		}
// 		//从Channel_id中取出
// 		var next_channel_id = Channel_id.shift();
// 		if(!next_channel_id) {console.log("卧槽,爬完了!") return ;}
// 		return crawl.user(next_channel_id,user_call);
// 	});

// }
module.exports = router;

