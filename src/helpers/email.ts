import sgMail, { MailDataRequired } from '@sendgrid/mail';
import { SMTP } from '../config/globals'
import Logger from '../core/Logger'

sgMail.setApiKey(SMTP.SENDGRID_API_KEY);

export const sendMail = async (msg: Omit<MailDataRequired, "from">) => {
  try {
    // @ts-ignore
    const ppp = await sgMail.send({ ...msg, from: SMTP.sender });
    console.log(ppp)
    Logger.info(`email send to ${msg.to}`)
    console.log('====================================');
    console.log(ppp);
    console.log('====================================');
  } catch (error) {
    console.log(error, "EMAIL ERROR")
    console.log('====================================');
    console.log(JSON.stringify(error, null, 2));
    console.log('====================================');
    Logger.info(`email send field: ${msg.to}`)
  }
}

export const sendTemplateMail = async (msg: Omit<MailDataRequired, "from">) => {
  try {
    // @ts-ignore
    const ppp = await sgMail.send({
      to: msg.to,
      from: SMTP.sender,
      templateId: msg.templateId,
      dynamicTemplateData: msg.dynamicTemplateData,
    })
    Logger.info(`email send to ${msg.to}`)
  } catch (error) {
    console.log('====================================');
    console.log(JSON.stringify(error, null, 2));
    console.log('====================================');
    Logger.info(`email send field: ${msg.to}`)
  }
}