var express = require('express');
var router = express.Router();
var superagent = require('superagent');
// var cheerio = require('cheerio');

var mongoose = require('mongoose');
// var redis = require('redis');
var config = require('./config.js');
var db = mongoose.connect('mongodb://localhost/same');
// var redisbs = redis.createClient(6379,'127.0.0.1');
//设置代理
require('superagent-proxy')(superagent);
var proxys = ['http://115.239.210.166:80','http://202.121.32.63:80','http://111.13.12.163:80','http://121.40.71.207'];
var proxy = process.env.http_proxy || 'http://115.239.210.166:80'

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
	User_id : [{id: 1332290}],
	User_hash : {},
	Channel_id : [{id: 1033563}],
	Channel_hash : {},
	host : "http://v2.same.com",
	crawl_user : function(callback){
		var self = this;
		var obj = self.Channel_id.shift();
		var url;var result;
		if (!obj) {console.log("用户数量和用户心情已经被爬完..."); return ;}
		if (obj.next){
			url = self.host + obj.next;
		}else{
			url = self.host + '/channel/' + obj.id + '/senses';
		}
		var proxy = proxys[Math.floor(Math.random()*4)]
		superagent.get(url)
				  .set(config.header)
				  .proxy(proxy)
				  .end(function(err,res){
				  	//console.log('res: ',res);
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
				  	//与hash对比去重
				  	var arr = [];var tmp;
				  	for (var i = 0; i< data.results.length; i++) {
				  		tmp = data.results[i].user.id
				  		if (!self.User_hash[tmp]) {
				  			 //console.log('UserID: ',tmp);
				  			arr.push({id : tmp});
				  			self.User_id.push({id : tmp});
						  	self.User_hash[tmp] = true;
				  		}
				  	}
				  	//数据库操作
				  	User.create(arr,function(err,result){
				  		if (err){ console.log(err)}
				  		 return self.crawl_user();
				  	});
				  });;

	},
	crawl_channel: function(callback){
		var proxy = proxys[Math.floor(Math.random()*4)]
		var self = this;
		var obj = self.User_id.shift();
		var url;var result;
		if (!obj) {console.log("用户频道已经被爬完..."); return ;}
		if (obj.next){
			url = self.host + obj.next;
		}else{
			url = self.host + '/user/' + obj.id + '/channels/write';
		}
		superagent.get(url)
				  .set(config.header)
				  .proxy(proxy)
				  .end(function(err,res){
				  	if (err) {console.log(err);}
				  	res.text = JSON.parse(res.text);
				  	var data = res.text.data;
				  	if (data.next){
				  		//推入user_id队列中 下次继续爬
				  		self.User_id.push({
				  			id: obj.id,
				  			next: data.next
				  		});
				  	}
				  	//对数据库和队列操作
				  	//爬完后存入hash
				  	//与hash对比去重
				  	var arr = [];var tmp;
				  	for (var i = 0; i< data.writed_channels.length;i++){
				  		tmp = data.writed_channels[i].channel.id
				  		if( !self.Channel_hash[tmp]){
				  			//console.log('ChannelId: ',tmp);
				  			arr.push({id : tmp});
				  			self.Channel_id.push({id : tmp});
						  	self.Channel_hash[tmp] = true;
				  		}
				  	}
				  	//数据库操作
				  	Channel.create(arr,function(err,result){
				  		if (err){ console.log(err)}
				  		 return self.crawl_channel();
				  	});
				  });;		

	}

};
/* 爬user. */
router.get('/user', function(req, res, next) {
	console.log('开始爬取same...');
	//从第一个userId开始爬channel
	Crawl.crawl_user();
});
//爬channel
router.get('/channel',function(req,res,next){
	Crawl.crawl_channel();
})



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

