import access from './access';
import admin from './admin';
import account from './account';
import announcement from './announcement';
import apiError from './apiError';
import app from './app';
import auth from './auth';
import categoryAdmin from './categoryAdmin';
import comments from './comments';
import common from './common';
import config from './config';
import facility from './facility';
import image from './image';
import issue from './issue';
import markdown from './markdown';
import media from './media';
import navigation from './navigation';
import notification from './notification';
import rateLimit from './rateLimit';
import request from './request';
import service from './service';
import settings from './settings';
import upload from './upload';
import ui from './ui';

const messages = {
  ...access,
  ...admin,
  ...account,
  ...announcement,
  ...apiError,
  ...app,
  ...auth,
  ...categoryAdmin,
  ...comments,
  ...common,
  ...config,
  ...facility,
  ...image,
  ...issue,
  ...markdown,
  ...media,
  ...navigation,
  ...notification,
  ...rateLimit,
  ...request,
  ...service,
  ...settings,
  ...upload,
  ...ui,
} as const;

export default messages;
