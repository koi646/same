var express = require('express');
var router = express.Router();
var superagent = require('superagent');
// var cheerio = require('cheerio');

var mongoose = require('mongoose');
var redis = require('redis');
var config = require('./config.js');
var db = mongoose.connect('mongodb://localhost/same');
//设置代理
require('superagent-proxy')(superagent);
var proxys = ['http://115.239.210.166:80','http://202.121.32.63:80','http://111.13.12.163:80','http://121.40.71.207'];
var proxy = proxys[3];
var redis = redis.createClient(6379,'127.0.0.1');
// redis.hmset('mugou',{"200":"lsl",qingting:321},function(err){console.log(err);console.log('---')});
// redis.hset('mugou',"200",function(err,res){console.log(res,'存进去了')});	
//初始化redis
redis.lpush('Userid_arr',JSON.stringify({"id":4269479}));
// redis.lpop('Userid',function(err,res){console.log(res)});
redis.lpush('Channelid_arr',JSON.stringify({"id": 1033563}));
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
	host : "http://v2.same.com",
	crawl_user : function(callback){
		var self = this;
		// var obj = self.Channel_id.shift();
		redis.lpop('Channelid_arr',function(err,obj){
			if (err) {console.log(err);}
			if (!obj) {
				console.log("用户数量和用户心情已经被爬完...");
				return ;
			}
			obj = JSON.parse(obj);
			var url;var result;
			if (obj.next){
				url = self.host + obj.next;
			}else{
				url = self.host + '/channel/' + obj.id + '/senses';
			}	
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
						obj.next = data.next;
						redis.lpush("Channelid_arr",JSON.stringify(obj));
					}
				  	//对数据库和队列操作
				  	//爬完后存入hash
				  	//与hash对比去重
				  	var arr = [];
				  	data.results.forEach(function(user,i){
				  		redis.hget("Userid_hash",user.id,function(err,has){
				  			if (err) {console.log(err);}
				  			if (!has){
				  				arr.push({id : user.id});console.log("userid:",user.id);
				  				redis.lpush("Userid_arr",JSON.stringify({"id": user.id}));
				  				redis.hset("Userid_hash",user.id,true);
				  			}
				  			//存入mongo
				  			User.create(arr,function(err,result){
				  				if (err) {
				  					console.log(err);
				  				}
				  				return self.crawl_user();
				  			})
				  		})
				  	})
				});					  						  							 
		})
	},
	crawl_channel: function(callback){
		var self = this;
		// var obj = self.Channel_id.shift();
		redis.lpop('Userid_arr',function(err,obj){
			if (err) {console.log(err);}
			if (!obj) {
				console.log("频道被爬完...");
				return ;
			}
			obj = JSON.parse(obj);
			var url;
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
						//推入channel_id队列中 下次继续爬
						obj.next = data.next;
						redis.lpush("Userid_arr",JSON.stringify(obj));
					}
				  	//对数据库和队列操作
				  	//爬完后存入hash
				  	//与hash对比去重
				  	var arr = [];
				  	data.writed_channels.forEach(function(result,i){
				  		redis.hget("Channelid_hash",result.channel.id,function(err,has){
				  			if (err) {console.log(err);}
				  			if (!has){
				  				arr.push({id : result.channel.id});console.log("channelid:",result.channel.id);
				  				redis.lpush("Channelid_arr",JSON.stringify({"id": result.channel.id}));
				  				redis.hset("Channelid_hash",result.channel.id,true);
				  			}
				  			//存入mongo				  														
				  			Channel.create(arr,function(err,result){
				  				if (err) {
				  					console.log(err);
				  				}
				  			});				  			
				  		})
				  	})
				  	return self.crawl_channel();
				});					  						  							 

		})
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

module.exports = router;

