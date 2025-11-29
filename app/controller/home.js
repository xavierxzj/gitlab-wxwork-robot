'use strict';

const Controller = require('egg').Controller;

class HomeController extends Controller {
  async index() {
    const { ctx } = this;
    const { path = '' } = ctx.params;
    const { body: gitlabEvent } = ctx.request;

    ctx.logger.info('request body: ', gitlabEvent);

    // Prepare environment variable keys
    const envSuffix = path ? `_${path.toUpperCase()}` : '';
    const wxWorkWebhookUrl = process.env[`WEBHOOK_URL${envSuffix}`];
    const feishuWebhookUrl = process.env[`FEISHU_WEBHOOK_URL${envSuffix}`];

    const tasks = [];

    // Task for WxWork
    if (wxWorkWebhookUrl) {
      tasks.push(this.sendWxWorkNotification(wxWorkWebhookUrl, gitlabEvent));
    }

    // Task for Feishu
    if (feishuWebhookUrl) {
      tasks.push(this.sendFeishuNotification(feishuWebhookUrl, gitlabEvent));
    }

    if (tasks.length === 0) {
      const errorMsg = 'No webhook URL configured for this path.';
      ctx.logger.error(errorMsg);
      ctx.body = { error: errorMsg };
      return;
    }

    const results = await Promise.all(tasks);

    ctx.body = results;
    ctx.logger.info('response body: ', ctx.body);
  }

  async sendWxWorkNotification(webhookUrl, gitlabEvent) {
    const { ctx } = this;
    const message = await ctx.service.webhook.translateMsg(gitlabEvent);

    if (!message) {
      ctx.logger.info('====> WxWork message is empty, suppressed.');
      return { platform: 'wxwork', success: true, msg: 'message is empty, suppressed.' };
    }

    try {
      const result = await ctx.curl(webhookUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json; charset=UTF-8' },
        dataType: 'json',
        timeout: 3000,
        data: message,
      });

      return {
        platform: 'wxwork',
        success: result.status === 200,
        webhook_url: webhookUrl,
        webhook_message: message,
        status: result.status,
        response_data: result.data,
      };
    } catch (err) {
      ctx.logger.error('Error sending WxWork notification:', err);
      return { platform: 'wxwork', success: false, error: err.message };
    }
  }

  async sendFeishuNotification(webhookUrl, gitlabEvent) {
    const { ctx } = this;
    // NOTE: This service method will be created in the next step.
    const message = await ctx.service.webhook.translateFeishuMsg(gitlabEvent);

    if (!message) {
      ctx.logger.info('====> Feishu message is empty, suppressed.');
      return { platform: 'feishu', success: true, msg: 'message is empty, suppressed.' };
    }

    try {
      const result = await ctx.curl(webhookUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json; charset=UTF-8' },
        dataType: 'json',
        timeout: 3000,
        data: message,
      });

      return {
        platform: 'feishu',
        success: result.status === 200,
        webhook_url: webhookUrl,
        webhook_message: message,
        status: result.status,
        response_data: result.data,
      };
    } catch (err) {
      ctx.logger.error('Error sending Feishu notification:', err);
      return { platform: 'feishu', success: false, error: err.message };
    }
  }
}

module.exports = HomeController;
