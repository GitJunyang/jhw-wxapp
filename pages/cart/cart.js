/*
 * @author: wes
 * @date: 2017-10-26
 * @desc: 购物车
*/
var app = getApp()
var util = require('../../utils/util.js')

Page({

  /**
   * 页面的初始数据
   */
  data: {
    totalPrice: 0,
    cartItemSet: [],
    curReceiver: {},
    curDelivery: {},
    curPaymentConfig: {},
    isloading: false,
    defaultColor:'',
    // coupon
    screenHeight: 0,
    screenWidth: 0,
    couponList: [],
    coupon: {
      couponTip: '点击使用优惠券'
    }
  },
  page: function (e) {
    wx.navigateTo({
      url: e.currentTarget.dataset.url
    })
  },
  pageTab: function (e) {
    wx.switchTab({
      url: '../index/index'
    })
  },

  // 购物车接口
  get: function () {
    var that = this
    wx.showNavigationBarLoading()
    that.setData({
      isloading: true
    })
    if (app.globalData.member === null) { app.getUserInfo() }
    wx.request({
      url: 'https://wx.jihui88.net/rest/api/shop/order/info1',
      data: {
        entId: app.globalData.enterpriseId,
        cIds: '',
        skey: app.globalData.member.skey
      },
      success: function (res) {
        wx.hideNavigationBarLoading()
        that.setData({
          isloading: false
        })
        wx.setStorage({
          data: (res.data.attributes && res.data.attributes.totalQuantity) || 0
        })
        if (!res.data.success) {
          that.setData({
            cartItemSet: []
          })
          return false
        }

        var data = res.data.attributes
        that.setData({
          cartItemSet: data.cartItemSet,
          deliveryType: data.deliveryType,
          integralProductList: data.integralProductList,
          issubtotal: data.issubtotal,
          memberPoint: data.memberPoint,
          paymentConfig: data.paymentConfig,
          receiver: data.receiver,
          totalPoint: data.totalPoint,
          totalPrice: data.totalPrice,
          totalQuantity: data.totalQuantity,
          totalWeightGram: data.totalWeightGram
        })

        var curReceiver = {}
        if (data.receiver.length > 0) {
          curReceiver = data.receiver[0]
          for (var i = 0; i < data.receiver.length; i++) {
            if (data.receiver[i].isDefault === '1') {
              curReceiver = data.receiver[i]
              break;
            }
          }
          wx.setStorage({
            key: 'curReceiver',
            data: curReceiver
          })
        }

        var curPaymentConfig = { paymentFee: 0 }
        if (data.paymentConfig.length > 0) {
          curPaymentConfig = data.paymentConfig[0]
          for (var i = 0; i < data.paymentConfig.length; i++) {
            if (data.paymentConfig[i].paymentConfigType === 'wxpay') {
              curPaymentConfig = data.paymentConfig[i]
              break;
            }
          }
        }

        // 配送方式
        var deliveryList = []
        if (data.deliveryType.length > 0) {
          for (var i = 0; i < data.deliveryType.length; i++) {
            deliveryList.push(data.deliveryType[i].name)
          }
        }

        that.setData({
          curPaymentConfig: curPaymentConfig,
          curReceiver: curReceiver,
          curDelivery: data.deliveryType[0] || { deliveryFee: 0 },
          deliveryList: deliveryList,
          deliveryIndex: 0
        })
        that.getDeliveryFee()
      }
    })
  },

  // 删除单个商品
  del: function (e) {
    var that = this
    var index = e.currentTarget.dataset.index
    wx.showLoading({
      title: '加载中',
    })
    wx.request({
      url: 'https://wx.jihui88.net/rest/api/shop/cartItem/delete',
      data: {
        id: e.currentTarget.dataset.id,
        skuCode: e.currentTarget.dataset.skucode,
        skey: app.globalData.member.skey
      },
      success: function (res) {
        wx.hideLoading()
        that.data.cartItemSet.splice(index, 1)
        that.setData({
          cartItemSet: that.data.cartItemSet,
          totalPoint: res.data.attributes.totalPoint,
          totalPrice: parseFloat(res.data.attributes.totalPrice.split('￥')[1]),
          totalQuantity: res.data.attributes.totalQuantity
        })
      }
    })
  },

  // 获取物流费用接口
  getDeliveryFee: function () {
    var that = this;
    if (!this.data.curDelivery.typeId || !this.data.curReceiver.receiverId) {
      console.log('error:获取物流数据不全');
    } else {
      wx.request({
        type: 'get',
        url: 'https://wx.jihui88.net/rest/api/shop/order/deliveryFee1',
        data: {
          typeId: this.data.curDelivery.typeId,
          receiverId: this.data.curReceiver.receiverId,
          totalWeightGram: this.data.totalWeightGram,
          skey: app.globalData.member.skey
        },
        success: function (res) {
          that.data.curDelivery.deliveryFee = res.data.attributes.deliveryFee || 0;
          that.setData({
            curDelivery: that.data.curDelivery
          })
        }
      })
    }
  },

  // 获取优惠券信息
  getCoupon: function () {
    var that = this;
    if (that.data.couponList.length > 0){
      that.openGain()
      return false
    }
    var productIds = ''
    for (var i=0; i<this.data.cartItemSet.length; i++) {
      productIds ? productIds += ','+this.data.cartItemSet[i].product.productId : productIds = this.data.cartItemSet[i].product.productId
    }
    wx.showNavigationBarLoading()
    wx.request({
      type: 'get',
      url: 'https://wx.jihui88.net/rest/api/comm/gain/paylist',
      data: {
        productIds: productIds,
        skey: app.globalData.member.skey
      },
      success: function (res) {
        wx.hideNavigationBarLoading()
        var data = res.data.attributes.data
        if (data.length === 0) {
          that.setData({
            'coupon.couponTip': '无可用优惠券'
          })
        } else {
          for (var i = 0; i < data.length; i++) {
            data[i].coupon.beginTime = util.formatTime(data[i].coupon.beginTime)
            data[i].coupon.endTime = util.formatTime(data[i].coupon.endTime)
          }
          that.setData({
            couponList: data
          })
          that.openGain()
        }
      }
    })
  },
  setCoupon: function (e) {
    var total = this.data.totalPrice + this.data.curPaymentConfig.paymentFee + this.data.curDelivery.deliveryFee
    var amount = e.currentTarget.dataset.amount
    if (total < e.currentTarget.dataset.threshold) {
        wx.showModal({
          title: '优惠券未满足要求'
        })
        return false
    } else if (total < amount) {
        wx.showModal({
          title: '优惠价格必需小于支付价格'
        })
        return false
    }
    var coupon = {
      couponGainId: e.currentTarget.dataset.id,
      amount: amount,
      couponTip: e.currentTarget.dataset.name
    }
    this.setData({
      coupon: coupon
    })
    this.closeGain()
  },
  openGain: function () {
    this.gainAn(0,this.data.screenWidth)
  },
  closeGain: function () {
    this.gainAn(this.data.screenWidth,0)
  },
  gainAn: function (anFrom, anTo,  modal) {
    var animation = wx.createAnimation({
      duration: 300,
      timingFunction: "linear",
      delay: 0
    })
    this.animation = animation
    animation.translateX(anFrom).step()
    this.setData({
      animationShare: animation.export()
    })
    setTimeout(function() {
      animation.translateX(anTo).step()
      this.setData({
        animationShare: animation.export()
      })
    }.bind(this), 0)
  },

  // 选中物流方式
  pickChange: function (e) {
    this.setData({
      curDelivery: this.data.deliveryType[e.detail.value],
      deliveryIndex: e.detail.value
    })
    this.getDeliveryFee()
  },

  // 微信支付
  pay: function () {
    if (this.data.curReceiver && !this.data.curReceiver.receiverId) {
      wx.showModal({
        title: '收货地址不能为空'
      })
      return false
    }
    if (this.data.curDelivery && !this.data.curDelivery.typeId) {
      wx.showModal({
        title: '配送方式不能为空'
      })
      return false
    }
    if (this.data.curPaymentConfig && !this.data.curPaymentConfig.paymentId) {
      wx.showModal({
        title: '未添加支付方式'
      })
      return false
    }
    wx.showLoading({
      title: '加载中',
    })
    var data = {
      entId: app.globalData.enterpriseId,
      cIds: '',
      receiverId: this.data.curReceiver.receiverId,
      typeId: this.data.curDelivery.typeId,
      configId: this.data.curPaymentConfig.paymentId,
      gainIds: this.data.coupon.couponGainId || '', // 优惠券id
    }
    data.model = JSON.stringify(data)
    data._method = 'post'
    data.skey = app.globalData.member.skey
    wx.request({
      method: 'post',
      url: 'https://wx.jihui88.net/rest/api/shop/order/save1',
      data: data,
      header: {
        'content-type': 'application/x-www-form-urlencoded'
      },
      success: function (res) {
        wx.hideLoading()
        var data = res.data.attributes
        wx.request({
          url: 'https://wx.jihui88.net/rest/pay/jsapi/getWxAppPayment',
          data: {
            appId: app.globalData.appid,
            orderId: data.orderId,
            skey: app.globalData.member.skey
          },
          success: function (res) {
            wx.requestPayment({
              'timeStamp': res.data.attributes.data.timeStamp,
              'nonceStr': res.data.attributes.data.nonceStr,
              'package': res.data.attributes.data.package,
              'signType': 'MD5',
              'paySign': res.data.attributes.data.sign,
              'success': function (res) {
                wx.showModal({
                  title: '支付完成'
                })
                wx.switchTab({
                  url: '../order/order'
                })
              },
              'fail': function (res) {
                wx.showModal({
                  title: res.err_desc
                })
                wx.switchTab({
                  url: '../order/order'
                })
              }
            })
          }
        })
      }
    })
  },

  onShow: function () {
    this.get()
    if (app.globalData.member === null) {
      app.getUserInfo()
    }
    // 设置选中的收货地址
    var key = wx.getStorageSync('curReceiver')
    if (key) {
      this.setData({
        curReceiver: key
      })
    }
    this.setData({
      defaultColor: app.globalData.defaultColor,
      primaryColor: app.globalData.primaryColor,
      screenHeight: app.screenHeight,
      screenWidth: app.screenWidth
    })
  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh: function () {
    this.get()
    wx.stopPullDownRefresh()
  },

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage: function () {
    return {
      title: '购物车'
    }
  }
})
