import json
import random
import sqlite3
import uuid
from datetime import datetime

# Apartment JSON extracted from 3D model
RAW_DATA = {
  "7": [
    {"Apartment": "P701", "Area": 122.63, "LivingFloor": "Level: Level 7", "GlobalId": "2WD79f5ZX9XvWMpvYcIJS0", "Category": "IfcSLAB"},
    {"Apartment": "P702", "Area": 116.32, "LivingFloor": "Level: Level 7", "GlobalId": "2WD79f5ZX9XvWMpvYcII0n", "Category": "IfcSLAB"},
    {"Apartment": "P703", "Area": 121.35, "LivingFloor": "Level: Level 7", "GlobalId": "0tiZbz39r9SfBx6bM$R18a", "Category": "IfcSLAB"},
    {"Apartment": "P704", "Area": 122.49, "LivingFloor": "Level: Level 7", "GlobalId": "0tiZbz39r9SfBx6bM$R1jr", "Category": "IfcSLAB"},
    {"Apartment": "P705", "Area": 115.79, "LivingFloor": "Level: Level 7", "GlobalId": "0tiZbz39r9SfBx6bM$R2Sa", "Category": "IfcSLAB"},
    {"Apartment": "P706", "Area": 119.63, "LivingFloor": "Level: Level 7", "GlobalId": "3WoiAhpb9EJwbShbVv5qX3", "Category": "IfcSLAB"},
    {"Apartment": "P707", "Area": 121.37, "LivingFloor": "Level: Level 7", "GlobalId": "3WoiAhpb9EJwbShbVv5h_8", "Category": "IfcSLAB"},
    {"Apartment": "P708", "Area": 123.34, "LivingFloor": "Level: Level 7", "GlobalId": "2ZRwajaR17qeg0VkOTXZbv", "Category": "IfcSLAB"}
  ],
  "8": [
    {"Apartment": "P801", "Area": 116.32, "LivingFloor": "Level: Level 8", "GlobalId": "0NARwhP6XDZvQZpmqwvdlu", "Category": "IfcSLAB"},
    {"Apartment": "P802", "Area": 121.35, "LivingFloor": "Level: Level 8", "GlobalId": "0NARwhP6XDZvQZpmqwvdkM", "Category": "IfcSLAB"},
    {"Apartment": "P803", "Area": 122.49, "LivingFloor": "Level: Level 8", "GlobalId": "0NARwhP6XDZvQZpmqwvdkS", "Category": "IfcSLAB"},
    {"Apartment": "P804", "Area": 115.79, "LivingFloor": "Level: Level 8", "GlobalId": "0NARwhP6XDZvQZpmqwvdkb", "Category": "IfcSLAB"},
    {"Apartment": "P805", "Area": 119.63, "LivingFloor": "Level: Level 8", "GlobalId": "0NARwhP6XDZvQZpmqwvdki", "Category": "IfcSLAB"},
    {"Apartment": "P806", "Area": 121.37, "LivingFloor": "Level: Level 8", "GlobalId": "0NARwhP6XDZvQZpmqwvdkr", "Category": "IfcSLAB"},
    {"Apartment": "P807", "Area": 123.34, "LivingFloor": "Level: Level 8", "GlobalId": "0NARwhP6XDZvQZpmqwvdf6", "Category": "IfcSLAB"},
    {"Apartment": "P808", "Area": 122.63, "LivingFloor": "Level: Level 8", "GlobalId": "0NARwhP6XDZvQZpmqwvdk0", "Category": "IfcSLAB"}
  ],
  "9": [
    {"Apartment": "P901", "Area": 106.4, "LivingFloor": "Level: Level 9", "GlobalId": "05h95zEXT4ow$4oOHn5zZp", "Category": "IfcSLAB"},
    {"Apartment": "P902", "Area": 121.35, "LivingFloor": "Level: Level 9", "GlobalId": "05h95zEXT4ow$4oOHn5zZb", "Category": "IfcSLAB"},
    {"Apartment": "P903", "Area": 122.49, "LivingFloor": "Level: Level 9", "GlobalId": "05h95zEXT4ow$4oOHn5zZl", "Category": "IfcSLAB"},
    {"Apartment": "P904", "Area": 106.61, "LivingFloor": "Level: Level 9", "GlobalId": "05h95zEXT4ow$4oOHn5zZG", "Category": "IfcSLAB"},
    {"Apartment": "P905", "Area": 109.23, "LivingFloor": "Level: Level 9", "GlobalId": "05h95zEXT4ow$4oOHn5zZV", "Category": "IfcSLAB"},
    {"Apartment": "P906", "Area": 121.37, "LivingFloor": "Level: Level 9", "GlobalId": "05h95zEXT4ow$4oOHn5zZ0", "Category": "IfcSLAB"},
    {"Apartment": "P907", "Area": 123.34, "LivingFloor": "Level: Level 9", "GlobalId": "05h95zEXT4ow$4oOHn5zYr", "Category": "IfcSLAB"},
    {"Apartment": "P908", "Area": 112.27, "LivingFloor": "Level: Level 9", "GlobalId": "05h95zEXT4ow$4oOHn5zZx", "Category": "IfcSLAB"}
  ],
  "10": [
    {"Apartment": "P1001", "Area": 106.4, "LivingFloor": "Level: Level 10", "GlobalId": "2met5ks5n6y8Qfj1a1NMDr", "Category": "IfcSLAB"},
    {"Apartment": "P1002", "Area": 121.35, "LivingFloor": "Level: Level 10", "GlobalId": "2met5ks5n6y8Qfj1a1NMD3", "Category": "IfcSLAB"},
    {"Apartment": "P1003", "Area": 122.49, "LivingFloor": "Level: Level 10", "GlobalId": "2met5ks5n6y8Qfj1a1NMD9", "Category": "IfcSLAB"},
    {"Apartment": "P1004", "Area": 106.61, "LivingFloor": "Level: Level 10", "GlobalId": "2met5ks5n6y8Qfj1a1NMDM", "Category": "IfcSLAB"},
    {"Apartment": "P1005", "Area": 109.23, "LivingFloor": "Level: Level 10", "GlobalId": "2met5ks5n6y8Qfj1a1NMDP", "Category": "IfcSLAB"},
    {"Apartment": "P1006", "Area": 121.37, "LivingFloor": "Level: Level 10", "GlobalId": "2met5ks5n6y8Qfj1a1NMCc", "Category": "IfcSLAB"},
    {"Apartment": "P1007", "Area": 123.34, "LivingFloor": "Level: Level 10", "GlobalId": "2met5ks5n6y8Qfj1a1NMCp", "Category": "IfcSLAB"},
    {"Apartment": "P1008", "Area": 112.27, "LivingFloor": "Level: Level 10", "GlobalId": "2met5ks5n6y8Qfj1a1NMDz", "Category": "IfcSLAB"}
  ],
  "11": [
    {"Apartment": "P1101", "Area": 106.4, "LivingFloor": "Level: Level 11", "GlobalId": "2met5ks5n6y8Qfj1a1NM7m", "Category": "IfcSLAB"},
    {"Apartment": "P1102", "Area": 121.35, "LivingFloor": "Level: Level 11", "GlobalId": "2met5ks5n6y8Qfj1a1NM7E", "Category": "IfcSLAB"},
    {"Apartment": "P1103", "Area": 122.49, "LivingFloor": "Level: Level 11", "GlobalId": "2met5ks5n6y8Qfj1a1NM7K", "Category": "IfcSLAB"},
    {"Apartment": "P1104", "Area": 106.61, "LivingFloor": "Level: Level 11", "GlobalId": "2met5ks5n6y8Qfj1a1NM7T", "Category": "IfcSLAB"},
    {"Apartment": "P1105", "Area": 109.23, "LivingFloor": "Level: Level 11", "GlobalId": "2met5ks5n6y8Qfj1a1NM6a", "Category": "IfcSLAB"},
    {"Apartment": "P1106", "Area": 121.37, "LivingFloor": "Level: Level 11", "GlobalId": "2met5ks5n6y8Qfj1a1NM6j", "Category": "IfcSLAB"},
    {"Apartment": "P1107", "Area": 123.34, "LivingFloor": "Level: Level 11", "GlobalId": "2met5ks5n6y8Qfj1a1NM6_", "Category": "IfcSLAB"},
    {"Apartment": "P1108", "Area": 112.27, "LivingFloor": "Level: Level 11", "GlobalId": "2met5ks5n6y8Qfj1a1NM7u", "Category": "IfcSLAB"}
  ],
  "12": [
    {"Apartment": "P1201", "Area": 106.4, "LivingFloor": "Level: Level 12", "GlobalId": "2met5ks5n6y8Qfj1a1NM1$", "Category": "IfcSLAB"},
    {"Apartment": "P1202", "Area": 121.35, "LivingFloor": "Level: Level 12", "GlobalId": "2met5ks5n6y8Qfj1a1NM1L", "Category": "IfcSLAB"},
    {"Apartment": "P1203", "Area": 122.49, "LivingFloor": "Level: Level 12", "GlobalId": "2met5ks5n6y8Qfj1a1NM1J", "Category": "IfcSLAB"},
    {"Apartment": "P1204", "Area": 106.61, "LivingFloor": "Level: Level 12", "GlobalId": "2met5ks5n6y8Qfj1a1NM1O", "Category": "IfcSLAB"},
    {"Apartment": "P1205", "Area": 109.23, "LivingFloor": "Level: Level 12", "GlobalId": "2met5ks5n6y8Qfj1a1NM0Z", "Category": "IfcSLAB"},
    {"Apartment": "P1206", "Area": 121.37, "LivingFloor": "Level: Level 12", "GlobalId": "2met5ks5n6y8Qfj1a1NM0e", "Category": "IfcSLAB"},
    {"Apartment": "P1207", "Area": 123.34, "LivingFloor": "Level: Level 12", "GlobalId": "2met5ks5n6y8Qfj1a1NM05", "Category": "IfcSLAB"},
    {"Apartment": "P1208", "Area": 112.27, "LivingFloor": "Level: Level 12", "GlobalId": "2met5ks5n6y8Qfj1a1NM17", "Category": "IfcSLAB"}
  ],
  "13": [
    {"Apartment": "P1301", "Area": 106.4, "LivingFloor": "Level: Level 13", "GlobalId": "2met5ks5n6y8Qfj1a1NLxw", "Category": "IfcSLAB"},
    {"Apartment": "P1302", "Area": 121.35, "LivingFloor": "Level: Level 13", "GlobalId": "2met5ks5n6y8Qfj1a1NLxG", "Category": "IfcSLAB"},
    {"Apartment": "P1303", "Area": 122.49, "LivingFloor": "Level: Level 13", "GlobalId": "2met5ks5n6y8Qfj1a1NLxU", "Category": "IfcSLAB"},
    {"Apartment": "P1304", "Area": 106.61, "LivingFloor": "Level: Level 13", "GlobalId": "2met5ks5n6y8Qfj1a1NLwd", "Category": "IfcSLAB"},
    {"Apartment": "P1305", "Area": 109.23, "LivingFloor": "Level: Level 13", "GlobalId": "2met5ks5n6y8Qfj1a1NLwk", "Category": "IfcSLAB"},
    {"Apartment": "P1306", "Area": 121.37, "LivingFloor": "Level: Level 13", "GlobalId": "2met5ks5n6y8Qfj1a1NLwt", "Category": "IfcSLAB"},
    {"Apartment": "P1307", "Area": 123.34, "LivingFloor": "Level: Level 13", "GlobalId": "2met5ks5n6y8Qfj1a1NLw0", "Category": "IfcSLAB"},
    {"Apartment": "P1308", "Area": 112.27, "LivingFloor": "Level: Level 13", "GlobalId": "2met5ks5n6y8Qfj1a1NLx2", "Category": "IfcSLAB"}
  ],
  "14": [
    {"Apartment": "P1401", "Area": 106.4, "LivingFloor": "Level: Level 14", "GlobalId": "2met5ks5n6y8Qfj1a1NLr1", "Category": "IfcSLAB"},
    {"Apartment": "P1402", "Area": 121.35, "LivingFloor": "Level: Level 14", "GlobalId": "2met5ks5n6y8Qfj1a1NLrV", "Category": "IfcSLAB"},
    {"Apartment": "P1403", "Area": 122.49, "LivingFloor": "Level: Level 14", "GlobalId": "2met5ks5n6y8Qfj1a1NLqb", "Category": "IfcSLAB"},
    {"Apartment": "P1404", "Area": 106.61, "LivingFloor": "Level: Level 14", "GlobalId": "2met5ks5n6y8Qfj1a1NLqY", "Category": "IfcSLAB"},
    {"Apartment": "P1405", "Area": 109.23, "LivingFloor": "Level: Level 14", "GlobalId": "2met5ks5n6y8Qfj1a1NLqr", "Category": "IfcSLAB"},
    {"Apartment": "P1406", "Area": 121.37, "LivingFloor": "Level: Level 14", "GlobalId": "2met5ks5n6y8Qfj1a1NLqo", "Category": "IfcSLAB"},
    {"Apartment": "P1407", "Area": 123.34, "LivingFloor": "Level: Level 14", "GlobalId": "2met5ks5n6y8Qfj1a1NLqF", "Category": "IfcSLAB"},
    {"Apartment": "P1408", "Area": 112.27, "LivingFloor": "Level: Level 14", "GlobalId": "2met5ks5n6y8Qfj1a1NLr9", "Category": "IfcSLAB"}
  ],
  "15": [
    {"Apartment": "P1501", "Area": 106.4, "LivingFloor": "Level: Level 15", "GlobalId": "2met5ks5n6y8Qfj1a1NLlC", "Category": "IfcSLAB"},
    {"Apartment": "P1502", "Area": 121.35, "LivingFloor": "Level: Level 15", "GlobalId": "2met5ks5n6y8Qfj1a1NLlQ", "Category": "IfcSLAB"},
    {"Apartment": "P1503", "Area": 122.49, "LivingFloor": "Level: Level 15", "GlobalId": "2met5ks5n6y8Qfj1a1NLkW", "Category": "IfcSLAB"},
    {"Apartment": "P1504", "Area": 106.61, "LivingFloor": "Level: Level 15", "GlobalId": "2met5ks5n6y8Qfj1a1NLkf", "Category": "IfcSLAB"},
    {"Apartment": "P1505", "Area": 109.23, "LivingFloor": "Level: Level 15", "GlobalId": "2met5ks5n6y8Qfj1a1NLkm", "Category": "IfcSLAB"},
    {"Apartment": "P1506", "Area": 121.37, "LivingFloor": "Level: Level 15", "GlobalId": "2met5ks5n6y8Qfj1a1NLkv", "Category": "IfcSLAB"},
    {"Apartment": "P1507", "Area": 123.34, "LivingFloor": "Level: Level 15", "GlobalId": "2met5ks5n6y8Qfj1a1NLkA", "Category": "IfcSLAB"},
    {"Apartment": "P1508", "Area": 112.27, "LivingFloor": "Level: Level 15", "GlobalId": "2met5ks5n6y8Qfj1a1NLlK", "Category": "IfcSLAB"}
  ],
  "16": [
    {"Apartment": "P1601", "Area": 106.4, "LivingFloor": "Level: Level 16", "GlobalId": "2met5ks5n6y8Qfj1a1NLfB", "Category": "IfcSLAB"},
    {"Apartment": "P1602", "Area": 121.35, "LivingFloor": "Level: Level 16", "GlobalId": "2met5ks5n6y8Qfj1a1NLeX", "Category": "IfcSLAB"},
    {"Apartment": "P1603", "Area": 122.49, "LivingFloor": "Level: Level 16", "GlobalId": "2met5ks5n6y8Qfj1a1NLel", "Category": "IfcSLAB"},
    {"Apartment": "P1604", "Area": 106.61, "LivingFloor": "Level: Level 16", "GlobalId": "2met5ks5n6y8Qfj1a1NLeq", "Category": "IfcSLAB"},
    {"Apartment": "P1605", "Area": 109.23, "LivingFloor": "Level: Level 16", "GlobalId": "2met5ks5n6y8Qfj1a1NLe$", "Category": "IfcSLAB"},
    {"Apartment": "P1606", "Area": 121.37, "LivingFloor": "Level: Level 16", "GlobalId": "2met5ks5n6y8Qfj1a1NLe4", "Category": "IfcSLAB"},
    {"Apartment": "P1607", "Area": 123.34, "LivingFloor": "Level: Level 16", "GlobalId": "2met5ks5n6y8Qfj1a1NLeH", "Category": "IfcSLAB"},
    {"Apartment": "P1608", "Area": 112.27, "LivingFloor": "Level: Level 16", "GlobalId": "2met5ks5n6y8Qfj1a1NLfJ", "Category": "IfcSLAB"}
  ],
  "17": [
    {"Apartment": "P1701", "Area": 106.4, "LivingFloor": "Level: Level 17", "GlobalId": "2met5ks5n6y8Qfj1a1NLZM", "Category": "IfcSLAB"},
    {"Apartment": "P1702", "Area": 121.35, "LivingFloor": "Level: Level 17", "GlobalId": "2met5ks5n6y8Qfj1a1NLYi", "Category": "IfcSLAB"},
    {"Apartment": "P1703", "Area": 122.49, "LivingFloor": "Level: Level 17", "GlobalId": "2met5ks5n6y8Qfj1a1NLYg", "Category": "IfcSLAB"},
    {"Apartment": "P1704", "Area": 106.61, "LivingFloor": "Level: Level 17", "GlobalId": "2met5ks5n6y8Qfj1a1NLYp", "Category": "IfcSLAB"},
    {"Apartment": "P1705", "Area": 109.23, "LivingFloor": "Level: Level 17", "GlobalId": "2met5ks5n6y8Qfj1a1NLYw", "Category": "IfcSLAB"},
    {"Apartment": "P1706", "Area": 121.37, "LivingFloor": "Level: Level 17", "GlobalId": "2met5ks5n6y8Qfj1a1NLY3", "Category": "IfcSLAB"},
    {"Apartment": "P1707", "Area": 123.34, "LivingFloor": "Level: Level 17", "GlobalId": "2met5ks5n6y8Qfj1a1NLYS", "Category": "IfcSLAB"},
    {"Apartment": "P1708", "Area": 112.27, "LivingFloor": "Level: Level 17", "GlobalId": "2met5ks5n6y8Qfj1a1NLZU", "Category": "IfcSLAB"}
  ],
  "18": [
    {"Apartment": "P1801", "Area": 106.4, "LivingFloor": "Level: Level 18", "GlobalId": "2met5ks5n6y8Qfj1a1NLTT", "Category": "IfcSLAB"},
    {"Apartment": "P1802", "Area": 121.35, "LivingFloor": "Level: Level 18", "GlobalId": "2met5ks5n6y8Qfj1a1NLSh", "Category": "IfcSLAB"},
    {"Apartment": "P1803", "Area": 122.49, "LivingFloor": "Level: Level 18", "GlobalId": "2met5ks5n6y8Qfj1a1NLSn", "Category": "IfcSLAB"},
    {"Apartment": "P1804", "Area": 106.61, "LivingFloor": "Level: Level 18", "GlobalId": "2met5ks5n6y8Qfj1a1NLS_", "Category": "IfcSLAB"},
    {"Apartment": "P1805", "Area": 109.23, "LivingFloor": "Level: Level 18", "GlobalId": "2met5ks5n6y8Qfj1a1NLS1", "Category": "IfcSLAB"},
    {"Apartment": "P1806", "Area": 121.37, "LivingFloor": "Level: Level 18", "GlobalId": "2met5ks5n6y8Qfj1a1NLSE", "Category": "IfcSLAB"},
    {"Apartment": "P1807", "Area": 123.34, "LivingFloor": "Level: Level 18", "GlobalId": "2met5ks5n6y8Qfj1a1NLSR", "Category": "IfcSLAB"},
    {"Apartment": "P1808", "Area": 112.27, "LivingFloor": "Level: Level 18", "GlobalId": "2met5ks5n6y8Qfj1a1NLSb", "Category": "IfcSLAB"}
  ],
  "19": [
    {"Apartment": "P1901", "Area": 106.4, "LivingFloor": "Level: Level 19", "GlobalId": "2met5ks5n6y8Qfj1a1NLNO", "Category": "IfcSLAB"},
    {"Apartment": "P1902", "Area": 121.35, "LivingFloor": "Level: Level 19", "GlobalId": "2met5ks5n6y8Qfj1a1NLMs", "Category": "IfcSLAB"},
    {"Apartment": "P1903", "Area": 122.49, "LivingFloor": "Level: Level 19", "GlobalId": "2met5ks5n6y8Qfj1a1NLMy", "Category": "IfcSLAB"},
    {"Apartment": "P1904", "Area": 106.61, "LivingFloor": "Level: Level 19", "GlobalId": "2met5ks5n6y8Qfj1a1NLM5", "Category": "IfcSLAB"},
    {"Apartment": "P1905", "Area": 109.23, "LivingFloor": "Level: Level 19", "GlobalId": "2met5ks5n6y8Qfj1a1NLMC", "Category": "IfcSLAB"},
    {"Apartment": "P1906", "Area": 121.37, "LivingFloor": "Level: Level 19", "GlobalId": "2met5ks5n6y8Qfj1a1NLML", "Category": "IfcSLAB"},
    {"Apartment": "P1907", "Area": 123.34, "LivingFloor": "Level: Level 19", "GlobalId": "2met5ks5n6y8Qfj1a1NLPc", "Category": "IfcSLAB"},
    {"Apartment": "P1908", "Area": 112.27, "LivingFloor": "Level: Level 19", "GlobalId": "2met5ks5n6y8Qfj1a1NLMW", "Category": "IfcSLAB"}
  ],
  "20": [
    {"Apartment": "P2001", "Area": 106.4, "LivingFloor": "Level: Level 20", "GlobalId": "2met5ks5n6y8Qfj1a1NLGd", "Category": "IfcSLAB"},
    {"Apartment": "P2002", "Area": 121.35, "LivingFloor": "Level: Level 20", "GlobalId": "2met5ks5n6y8Qfj1a1NLGz", "Category": "IfcSLAB"},
    {"Apartment": "P2003", "Area": 122.49, "LivingFloor": "Level: Level 20", "GlobalId": "2met5ks5n6y8Qfj1a1NLGx", "Category": "IfcSLAB"},
    {"Apartment": "P2004", "Area": 106.61, "LivingFloor": "Level: Level 20", "GlobalId": "2met5ks5n6y8Qfj1a1NLG0", "Category": "IfcSLAB"},
    {"Apartment": "P2005", "Area": 109.23, "LivingFloor": "Level: Level 20", "GlobalId": "2met5ks5n6y8Qfj1a1NLGB", "Category": "IfcSLAB"},
    {"Apartment": "P2006", "Area": 121.37, "LivingFloor": "Level: Level 20", "GlobalId": "2met5ks5n6y8Qfj1a1NLGG", "Category": "IfcSLAB"},
    {"Apartment": "P2007", "Area": 123.34, "LivingFloor": "Level: Level 20", "GlobalId": "2met5ks5n6y8Qfj1a1NLJj", "Category": "IfcSLAB"},
    {"Apartment": "P2008", "Area": 112.27, "LivingFloor": "Level: Level 20", "GlobalId": "2met5ks5n6y8Qfj1a1NLGl", "Category": "IfcSLAB"}
  ],
  "21": [
    {"Apartment": "P2101", "Area": 106.4, "LivingFloor": "Level: Level 21", "GlobalId": "2met5ks5n6y8Qfj1a1NLAY", "Category": "IfcSLAB"},
    {"Apartment": "P2102", "Area": 121.35, "LivingFloor": "Level: Level 21", "GlobalId": "2met5ks5n6y8Qfj1a1NLAu", "Category": "IfcSLAB"},
    {"Apartment": "P2103", "Area": 122.49, "LivingFloor": "Level: Level 21", "GlobalId": "2met5ks5n6y8Qfj1a1NLA6", "Category": "IfcSLAB"},
    {"Apartment": "P2104", "Area": 106.61, "LivingFloor": "Level: Level 21", "GlobalId": "2met5ks5n6y8Qfj1a1NLAF", "Category": "IfcSLAB"},
    {"Apartment": "P2105", "Area": 109.23, "LivingFloor": "Level: Level 21", "GlobalId": "2met5ks5n6y8Qfj1a1NLAM", "Category": "IfcSLAB"},
    {"Apartment": "P2106", "Area": 121.37, "LivingFloor": "Level: Level 21", "GlobalId": "2met5ks5n6y8Qfj1a1NLAV", "Category": "IfcSLAB"},
    {"Apartment": "P2107", "Area": 123.34, "LivingFloor": "Level: Level 21", "GlobalId": "2met5ks5n6y8Qfj1a1NLDe", "Category": "IfcSLAB"},
    {"Apartment": "P2108", "Area": 112.27, "LivingFloor": "Level: Level 21", "GlobalId": "2met5ks5n6y8Qfj1a1NLAg", "Category": "IfcSLAB"}
  ],
  "22": [
    {"Apartment": "P2201", "Area": 106.4, "LivingFloor": "Level: Level 22", "GlobalId": "2met5ks5n6y8Qfj1a1NL4f", "Category": "IfcSLAB"},
    {"Apartment": "P2202", "Area": 121.35, "LivingFloor": "Level: Level 22", "GlobalId": "2met5ks5n6y8Qfj1a1NL47", "Category": "IfcSLAB"},
    {"Apartment": "P2203", "Area": 122.49, "LivingFloor": "Level: Level 22", "GlobalId": "2met5ks5n6y8Qfj1a1NL4D", "Category": "IfcSLAB"},
    {"Apartment": "P2204", "Area": 106.61, "LivingFloor": "Level: Level 22", "GlobalId": "2met5ks5n6y8Qfj1a1NL4A", "Category": "IfcSLAB"},
    {"Apartment": "P2205", "Area": 109.23, "LivingFloor": "Level: Level 22", "GlobalId": "2met5ks5n6y8Qfj1a1NL4T", "Category": "IfcSLAB"},
    {"Apartment": "P2206", "Area": 121.37, "LivingFloor": "Level: Level 22", "GlobalId": "2met5ks5n6y8Qfj1a1NL4Q", "Category": "IfcSLAB"},
    {"Apartment": "P2207", "Area": 123.34, "LivingFloor": "Level: Level 22", "GlobalId": "2met5ks5n6y8Qfj1a1NL7t", "Category": "IfcSLAB"},
    {"Apartment": "P2208", "Area": 112.27, "LivingFloor": "Level: Level 22", "GlobalId": "2met5ks5n6y8Qfj1a1NL4n", "Category": "IfcSLAB"}
  ],
  "23": [
    {"Apartment": "P2301", "Area": 106.4, "LivingFloor": "Level: Level 23", "GlobalId": "2met5ks5n6y8Qfj1a1NK_q", "Category": "IfcSLAB"},
    {"Apartment": "P2302", "Area": 121.35, "LivingFloor": "Level: Level 23", "GlobalId": "2met5ks5n6y8Qfj1a1NK_2", "Category": "IfcSLAB"},
    {"Apartment": "P2303", "Area": 122.49, "LivingFloor": "Level: Level 23", "GlobalId": "2met5ks5n6y8Qfj1a1NK_8", "Category": "IfcSLAB"},
    {"Apartment": "P2304", "Area": 106.61, "LivingFloor": "Level: Level 23", "GlobalId": "2met5ks5n6y8Qfj1a1NK_H", "Category": "IfcSLAB"},
    {"Apartment": "P2305", "Area": 109.23, "LivingFloor": "Level: Level 23", "GlobalId": "2met5ks5n6y8Qfj1a1NK_O", "Category": "IfcSLAB"},
    {"Apartment": "P2306", "Area": 121.37, "LivingFloor": "Level: Level 23", "GlobalId": "2met5ks5n6y8Qfj1a1NL1X", "Category": "IfcSLAB"},
    {"Apartment": "P2307", "Area": 123.34, "LivingFloor": "Level: Level 23", "GlobalId": "2met5ks5n6y8Qfj1a1NL1o", "Category": "IfcSLAB"},
    {"Apartment": "P2308", "Area": 112.27, "LivingFloor": "Level: Level 23", "GlobalId": "2met5ks5n6y8Qfj1a1NK_y", "Category": "IfcSLAB"}
  ],
  "24": [
    {"Apartment": "P2401", "Area": 106.4, "LivingFloor": "Level: Level 24", "GlobalId": "2met5ks5n6y8Qfj1a1NKup", "Category": "IfcSLAB"},
    {"Apartment": "P2402", "Area": 121.35, "LivingFloor": "Level: Level 24", "GlobalId": "2met5ks5n6y8Qfj1a1NKu9", "Category": "IfcSLAB"},
    {"Apartment": "P2403", "Area": 122.49, "LivingFloor": "Level: Level 24", "GlobalId": "2met5ks5n6y8Qfj1a1NKuN", "Category": "IfcSLAB"},
    {"Apartment": "P2404", "Area": 106.61, "LivingFloor": "Level: Level 24", "GlobalId": "2met5ks5n6y8Qfj1a1NKuS", "Category": "IfcSLAB"},
    {"Apartment": "P2405", "Area": 109.23, "LivingFloor": "Level: Level 24", "GlobalId": "2met5ks5n6y8Qfj1a1NKxd", "Category": "IfcSLAB"},
    {"Apartment": "P2406", "Area": 121.37, "LivingFloor": "Level: Level 24", "GlobalId": "2met5ks5n6y8Qfj1a1NKxi", "Category": "IfcSLAB"},
    {"Apartment": "P2407", "Area": 123.34, "LivingFloor": "Level: Level 24", "GlobalId": "2met5ks5n6y8Qfj1a1NKxv", "Category": "IfcSLAB"},
    {"Apartment": "P2408", "Area": 112.27, "LivingFloor": "Level: Level 24", "GlobalId": "2met5ks5n6y8Qfj1a1NKux", "Category": "IfcSLAB"}
  ],
  "25": [
    {"Apartment": "P2501", "Area": 106.4, "LivingFloor": "Level: Level 25", "GlobalId": "2met5ks5n6y8Qfj1a1NKo_", "Category": "IfcSLAB"},
    {"Apartment": "P2502", "Area": 121.35, "LivingFloor": "Level: Level 25", "GlobalId": "2met5ks5n6y8Qfj1a1NKoK", "Category": "IfcSLAB"},
    {"Apartment": "P2503", "Area": 122.49, "LivingFloor": "Level: Level 25", "GlobalId": "2met5ks5n6y8Qfj1a1NKoI", "Category": "IfcSLAB"},
    {"Apartment": "P2504", "Area": 106.61, "LivingFloor": "Level: Level 25", "GlobalId": "2met5ks5n6y8Qfj1a1NKoR", "Category": "IfcSLAB"},
    {"Apartment": "P2505", "Area": 109.23, "LivingFloor": "Level: Level 25", "GlobalId": "2met5ks5n6y8Qfj1a1NKrY", "Category": "IfcSLAB"},
    {"Apartment": "P2506", "Area": 121.37, "LivingFloor": "Level: Level 25", "GlobalId": "2met5ks5n6y8Qfj1a1NKrh", "Category": "IfcSLAB"},
    {"Apartment": "P2507", "Area": 123.34, "LivingFloor": "Level: Level 25", "GlobalId": "2met5ks5n6y8Qfj1a1NKr4", "Category": "IfcSLAB"},
    {"Apartment": "P2508", "Area": 112.27, "LivingFloor": "Level: Level 25", "GlobalId": "2met5ks5n6y8Qfj1a1NKo6", "Category": "IfcSLAB"}
  ],
  "26": [
    {"Apartment": "P2601", "Area": 106.4, "LivingFloor": "Level: Level 26", "GlobalId": "2met5ks5n6y8Qfj1a1NKi5", "Category": "IfcSLAB"},
    {"Apartment": "P2602", "Area": 121.35, "LivingFloor": "Level: Level 26", "GlobalId": "2met5ks5n6y8Qfj1a1NKiJ", "Category": "IfcSLAB"},
    {"Apartment": "P2603", "Area": 122.49, "LivingFloor": "Level: Level 26", "GlobalId": "2met5ks5n6y8Qfj1a1NKiP", "Category": "IfcSLAB"},
    {"Apartment": "P2604", "Area": 106.61, "LivingFloor": "Level: Level 26", "GlobalId": "2met5ks5n6y8Qfj1a1NKlc", "Category": "IfcSLAB"},
    {"Apartment": "P2605", "Area": 109.23, "LivingFloor": "Level: Level 26", "GlobalId": "2met5ks5n6y8Qfj1a1NKlf", "Category": "IfcSLAB"},
    {"Apartment": "P2606", "Area": 121.37, "LivingFloor": "Level: Level 26", "GlobalId": "2met5ks5n6y8Qfj1a1NKls", "Category": "IfcSLAB"},
    {"Apartment": "P2607", "Area": 123.34, "LivingFloor": "Level: Level 26", "GlobalId": "2met5ks5n6y8Qfj1a1NKl3", "Category": "IfcSLAB"},
    {"Apartment": "P2608", "Area": 112.27, "LivingFloor": "Level: Level 26", "GlobalId": "2met5ks5n6y8Qfj1a1NKiD", "Category": "IfcSLAB"}
  ],
  "27": [
    {"Apartment": "P2701", "Area": 106.4, "LivingFloor": "Level: Level 27", "GlobalId": "2met5ks5n6y8Qfj1a1NKc0", "Category": "IfcSLAB"},
    {"Apartment": "P2702", "Area": 121.35, "LivingFloor": "Level: Level 27", "GlobalId": "2met5ks5n6y8Qfj1a1NKcU", "Category": "IfcSLAB"},
    {"Apartment": "P2703", "Area": 122.49, "LivingFloor": "Level: Level 27", "GlobalId": "2met5ks5n6y8Qfj1a1NKfa", "Category": "IfcSLAB"},
    {"Apartment": "P2704", "Area": 106.61, "LivingFloor": "Level: Level 27", "GlobalId": "2met5ks5n6y8Qfj1a1NKfj", "Category": "IfcSLAB"},
    {"Apartment": "P2705", "Area": 109.23, "LivingFloor": "Level: Level 27", "GlobalId": "2met5ks5n6y8Qfj1a1NKfq", "Category": "IfcSLAB"},
    {"Apartment": "P2706", "Area": 121.37, "LivingFloor": "Level: Level 27", "GlobalId": "2met5ks5n6y8Qfj1a1NKfz", "Category": "IfcSLAB"},
    {"Apartment": "P2707", "Area": 123.34, "LivingFloor": "Level: Level 27", "GlobalId": "2met5ks5n6y8Qfj1a1NKfE", "Category": "IfcSLAB"},
    {"Apartment": "P2708", "Area": 112.27, "LivingFloor": "Level: Level 27", "GlobalId": "2met5ks5n6y8Qfj1a1NKc8", "Category": "IfcSLAB"}
  ],
  "28": [
    {"Apartment": "P2801", "Area": 106.4, "LivingFloor": "Level: Level 28", "GlobalId": "2met5ks5n6y8Qfj1a1NKWF", "Category": "IfcSLAB"},
    {"Apartment": "P2802", "Area": 121.35, "LivingFloor": "Level: Level 28", "GlobalId": "2met5ks5n6y8Qfj1a1NKZb", "Category": "IfcSLAB"},
    {"Apartment": "P2803", "Area": 122.49, "LivingFloor": "Level: Level 28", "GlobalId": "2met5ks5n6y8Qfj1a1NKZZ", "Category": "IfcSLAB"},
    {"Apartment": "P2804", "Area": 106.61, "LivingFloor": "Level: Level 28", "GlobalId": "2met5ks5n6y8Qfj1a1NKZe", "Category": "IfcSLAB"},
    {"Apartment": "P2805", "Area": 109.23, "LivingFloor": "Level: Level 28", "GlobalId": "2met5ks5n6y8Qfj1a1NKZp", "Category": "IfcSLAB"},
    {"Apartment": "P2806", "Area": 121.37, "LivingFloor": "Level: Level 28", "GlobalId": "2met5ks5n6y8Qfj1a1NKZu", "Category": "IfcSLAB"},
    {"Apartment": "P2807", "Area": 123.34, "LivingFloor": "Level: Level 28", "GlobalId": "2met5ks5n6y8Qfj1a1NKZL", "Category": "IfcSLAB"},
    {"Apartment": "P2808", "Area": 112.27, "LivingFloor": "Level: Level 28", "GlobalId": "2met5ks5n6y8Qfj1a1NKWN", "Category": "IfcSLAB"}
  ],
  "29": [
    {"Apartment": "P2901", "Area": 106.4, "LivingFloor": "Level: Level 29", "GlobalId": "2met5ks5n6y8Qfj1a1NKQA", "Category": "IfcSLAB"},
    {"Apartment": "P2902", "Area": 121.35, "LivingFloor": "Level: Level 29", "GlobalId": "2met5ks5n6y8Qfj1a1NKTW", "Category": "IfcSLAB"},
    {"Apartment": "P2903", "Area": 122.49, "LivingFloor": "Level: Level 29", "GlobalId": "2met5ks5n6y8Qfj1a1NKTk", "Category": "IfcSLAB"},
    {"Apartment": "P2904", "Area": 106.61, "LivingFloor": "Level: Level 29", "GlobalId": "2met5ks5n6y8Qfj1a1NKTt", "Category": "IfcSLAB"},
    {"Apartment": "P2905", "Area": 109.23, "LivingFloor": "Level: Level 29", "GlobalId": "2met5ks5n6y8Qfj1a1NKT_", "Category": "IfcSLAB"},
    {"Apartment": "P2906", "Area": 121.37, "LivingFloor": "Level: Level 29", "GlobalId": "2met5ks5n6y8Qfj1a1NKT7", "Category": "IfcSLAB"},
    {"Apartment": "P2907", "Area": 123.34, "LivingFloor": "Level: Level 29", "GlobalId": "2met5ks5n6y8Qfj1a1NKTG", "Category": "IfcSLAB"},
    {"Apartment": "P2908", "Area": 112.27, "LivingFloor": "Level: Level 29", "GlobalId": "2met5ks5n6y8Qfj1a1NKQI", "Category": "IfcSLAB"}
  ],
  "30": [
    {"Apartment": "P3001", "Area": 106.4, "LivingFloor": "Level: Level 30", "GlobalId": "2met5ks5n6y8Qfj1a1NKKH", "Category": "IfcSLAB"},
    {"Apartment": "P3002", "Area": 121.35, "LivingFloor": "Level: Level 30", "GlobalId": "2met5ks5n6y8Qfj1a1NKNl", "Category": "IfcSLAB"},
    {"Apartment": "P3003", "Area": 122.49, "LivingFloor": "Level: Level 30", "GlobalId": "2met5ks5n6y8Qfj1a1NKNr", "Category": "IfcSLAB"},
    {"Apartment": "P3004", "Area": 106.61, "LivingFloor": "Level: Level 30", "GlobalId": "2met5ks5n6y8Qfj1a1NKNo", "Category": "IfcSLAB"},
    {"Apartment": "P3005", "Area": 109.23, "LivingFloor": "Level: Level 30", "GlobalId": "2met5ks5n6y8Qfj1a1NKN5", "Category": "IfcSLAB"},
    {"Apartment": "P3006", "Area": 121.37, "LivingFloor": "Level: Level 30", "GlobalId": "2met5ks5n6y8Qfj1a1NKN2", "Category": "IfcSLAB"},
    {"Apartment": "P3007", "Area": 123.34, "LivingFloor": "Level: Level 30", "GlobalId": "2met5ks5n6y8Qfj1a1NKNV", "Category": "IfcSLAB"},
    {"Apartment": "P3008", "Area": 112.27, "LivingFloor": "Level: Level 30", "GlobalId": "2met5ks5n6y8Qfj1a1NKKP", "Category": "IfcSLAB"}
  ],
  "31": [
    {"Apartment": "P3101", "Area": 106.4, "LivingFloor": "Level: Level 31", "GlobalId": "2met5ks5n6y8Qfj1a1NKES", "Category": "IfcSLAB"},
    {"Apartment": "P3102", "Area": 121.35, "LivingFloor": "Level: Level 31", "GlobalId": "2met5ks5n6y8Qfj1a1NKHg", "Category": "IfcSLAB"},
    {"Apartment": "P3103", "Area": 122.49, "LivingFloor": "Level: Level 31", "GlobalId": "2met5ks5n6y8Qfj1a1NKHm", "Category": "IfcSLAB"},
    {"Apartment": "P3104", "Area": 106.61, "LivingFloor": "Level: Level 31", "GlobalId": "2met5ks5n6y8Qfj1a1NKHv", "Category": "IfcSLAB"},
    {"Apartment": "P3105", "Area": 109.23, "LivingFloor": "Level: Level 31", "GlobalId": "2met5ks5n6y8Qfj1a1NKH0", "Category": "IfcSLAB"},
    {"Apartment": "P3106", "Area": 121.37, "LivingFloor": "Level: Level 31", "GlobalId": "2met5ks5n6y8Qfj1a1NKH9", "Category": "IfcSLAB"},
    {"Apartment": "P3107", "Area": 123.34, "LivingFloor": "Level: Level 31", "GlobalId": "2met5ks5n6y8Qfj1a1NKHQ", "Category": "IfcSLAB"},
    {"Apartment": "P3108", "Area": 112.27, "LivingFloor": "Level: Level 31", "GlobalId": "2met5ks5n6y8Qfj1a1NKHa", "Category": "IfcSLAB"}
  ],
  "32": [
    {"Apartment": "P3201", "Area": 106.4, "LivingFloor": "Level: Level 32", "GlobalId": "2met5ks5n6y8Qfj1a1NK8R", "Category": "IfcSLAB"},
    {"Apartment": "P3202", "Area": 121.35, "LivingFloor": "Level: Level 32", "GlobalId": "2met5ks5n6y8Qfj1a1NKBn", "Category": "IfcSLAB"},
    {"Apartment": "P3203", "Area": 122.49, "LivingFloor": "Level: Level 32", "GlobalId": "2met5ks5n6y8Qfj1a1NKB$", "Category": "IfcSLAB"},
    {"Apartment": "P3204", "Area": 106.61, "LivingFloor": "Level: Level 32", "GlobalId": "2met5ks5n6y8Qfj1a1NKB4", "Category": "IfcSLAB"},
    {"Apartment": "P3205", "Area": 109.23, "LivingFloor": "Level: Level 32", "GlobalId": "2met5ks5n6y8Qfj1a1NKBF", "Category": "IfcSLAB"},
    {"Apartment": "P3206", "Area": 121.37, "LivingFloor": "Level: Level 32", "GlobalId": "2met5ks5n6y8Qfj1a1NKBK", "Category": "IfcSLAB"},
    {"Apartment": "P3207", "Area": 123.34, "LivingFloor": "Level: Level 32", "GlobalId": "2met5ks5n6y8Qfj1a1NKAX", "Category": "IfcSLAB"},
    {"Apartment": "P3208", "Area": 112.27, "LivingFloor": "Level: Level 32", "GlobalId": "2met5ks5n6y8Qfj1a1NKBZ", "Category": "IfcSLAB"}
  ],
  "33": [
    {"Apartment": "P3301", "Area": 106.4, "LivingFloor": "Level: Level 33", "GlobalId": "2met5ks5n6y8Qfj1a1NK5c", "Category": "IfcSLAB"},
    {"Apartment": "P3302", "Area": 121.35, "LivingFloor": "Level: Level 33", "GlobalId": "2met5ks5n6y8Qfj1a1NK5y", "Category": "IfcSLAB"},
    {"Apartment": "P3303", "Area": 122.49, "LivingFloor": "Level: Level 33", "GlobalId": "2met5ks5n6y8Qfj1a1NK5w", "Category": "IfcSLAB"},
    {"Apartment": "P3304", "Area": 106.61, "LivingFloor": "Level: Level 33", "GlobalId": "2met5ks5n6y8Qfj1a1NK53", "Category": "IfcSLAB"},
    {"Apartment": "P3305", "Area": 109.23, "LivingFloor": "Level: Level 33", "GlobalId": "2met5ks5n6y8Qfj1a1NK5A", "Category": "IfcSLAB"},
    {"Apartment": "P3306", "Area": 121.37, "LivingFloor": "Level: Level 33", "GlobalId": "2met5ks5n6y8Qfj1a1NK5J", "Category": "IfcSLAB"},
    {"Apartment": "P3307", "Area": 123.34, "LivingFloor": "Level: Level 33", "GlobalId": "2met5ks5n6y8Qfj1a1NK4i", "Category": "IfcSLAB"},
    {"Apartment": "P3308", "Area": 112.27, "LivingFloor": "Level: Level 33", "GlobalId": "2met5ks5n6y8Qfj1a1NK5k", "Category": "IfcSLAB"}
  ],
  "34": [
    {"Apartment": "P3401", "Area": 106.4, "LivingFloor": "Level: Level 34", "GlobalId": "2met5ks5n6y8Qfj1a1NR$j", "Category": "IfcSLAB"},
    {"Apartment": "P3402", "Area": 121.35, "LivingFloor": "Level: Level 34", "GlobalId": "2met5ks5n6y8Qfj1a1NR$x", "Category": "IfcSLAB"},
    {"Apartment": "P3403", "Area": 122.49, "LivingFloor": "Level: Level 34", "GlobalId": "2met5ks5n6y8Qfj1a1NR$1", "Category": "IfcSLAB"},
    {"Apartment": "P3404", "Area": 106.61, "LivingFloor": "Level: Level 34", "GlobalId": "2met5ks5n6y8Qfj1a1NR$E", "Category": "IfcSLAB"},
    {"Apartment": "P3405", "Area": 109.23, "LivingFloor": "Level: Level 34", "GlobalId": "2met5ks5n6y8Qfj1a1NR$H", "Category": "IfcSLAB"},
    {"Apartment": "P3406", "Area": 121.37, "LivingFloor": "Level: Level 34", "GlobalId": "2met5ks5n6y8Qfj1a1NR$U", "Category": "IfcSLAB"},
    {"Apartment": "P3407", "Area": 123.34, "LivingFloor": "Level: Level 34", "GlobalId": "2met5ks5n6y8Qfj1a1NR_h", "Category": "IfcSLAB"},
    {"Apartment": "P3408", "Area": 112.27, "LivingFloor": "Level: Level 34", "GlobalId": "2met5ks5n6y8Qfj1a1NR$r", "Category": "IfcSLAB"}
  ]
}

# Vietnamese Name Generator Components
HO_LIST = ["Nguyễn", "Trần", "Lê", "Phạm", "Hoàng", "Huỳnh", "Phan", "Vũ", "Võ", "Đặng", "Bùi", "Đỗ", "Hồ", "Ngô", "Dương", "Lý", "Đinh", "Đoàn", "Lâm", "Trịnh"]
DEM_NAM = ["Văn", "Đức", "Minh", "Hoàng", "Hữu", "Thanh", "Quốc", "Gia", "Bảo", "Tuấn", "Hải", "Đình", "Xuân", "Khắc", "Trọng"]
DEM_NU = ["Thị", "Ngọc", "Thu", "Kim", "Phương", "Thanh", "Mai", "Hồng", "Diệu", "Ánh", "Mỹ", "Quỳnh", "Thùy", "Bích", "Yến"]
TEN_NAM = ["An", "Bình", "Cường", "Dũng", "Đạt", "Đức", "Hải", "Hiếu", "Hùng", "Huy", "Khánh", "Khoa", "Kiên", "Lâm", "Long", "Minh", "Nam", "Nghĩa", "Phong", "Phúc", "Quân", "Quang", "Sơn", "Tâm", "Thắng", "Thịnh", "Tiến", "Toàn", "Trung", "Tú", "Tùng", "Việt", "Vinh", "Vũ"]
TEN_NU = ["Anh", "Bích", "Chi", "Dung", "Duyên", "Giang", "Hà", "Hạnh", "Hoa", "Hương", "Huyền", "Khánh", "Lan", "Linh", "Loan", "Mai", "My", "Nga", "Ngân", "Ngọc", "Nhung", "Oanh", "Phương", "Phượng", "Quỳnh", "Tâm", "Thảo", "Thu", "Thư", "Thủy", "Trang", "Trâm", "Tuyết", "Uyên", "Vân", "Vy", "Yến"]

random.seed(42)  # For reproducible realistic data generation

def generate_vietnamese_name(gender="random"):
    if gender == "random":
        gender = random.choice(["male", "female"])
    ho = random.choice(HO_LIST)
    if gender == "male":
        dem = random.choice(DEM_NAM)
        ten = random.choice(TEN_NAM)
    else:
        dem = random.choice(DEM_NU)
        ten = random.choice(TEN_NU)
    return f"{ho} {dem} {ten}", gender

def generate_phone():
    prefixes = ["090", "091", "098", "097", "093", "094", "088", "086", "070", "079"]
    return f"{random.choice(prefixes)}{random.randint(1000000, 9999999)}"

def generate_cccd():
    return f"0790{random.randint(70, 99):02d}{random.randint(100000, 999999):06d}"

def generate_dob(min_age=20, max_age=70):
    year = 2026 - random.randint(min_age, max_age)
    month = random.randint(1, 12)
    day = random.randint(1, 28)
    return f"{year:04d}-{month:02d}-{day:02d}"

def remove_accents(text):
    import unicodedata
    nfkd = unicodedata.normalize('NFKD', text)
    res = u"".join([c for c in nfkd if not unicodedata.combining(c)])
    return res.replace('đ', 'd').replace('Đ', 'D').lower()

def populate():
    db_path = "backend/bim-platform-v2.db"
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()

    cur.execute("SELECT id, code, name FROM buildings WHERE name = 'm5new' OR code = 'M5N'")
    bldg = cur.fetchone()
    if not bldg:
        print("Building m5new not found! Checking buildings...")
        cur.execute("SELECT id, code, name FROM buildings")
        print(cur.fetchall())
        return

    building_id, building_code, building_name = bldg
    print(f"Target building: id={building_id}, code={building_code}, name={building_name}")

    cur.execute("SELECT id FROM organizations LIMIT 1")
    org = cur.fetchone()
    org_id = org[0] if org else "00000000-0000-4000-8000-000000000001"

    cur.execute("SELECT id FROM units WHERE building_id = ?", (building_id,))
    old_unit_ids = [r[0] for r in cur.fetchall()]
    if old_unit_ids:
        cur.execute("DELETE FROM occupancies WHERE building_id = ?", (building_id,))
        cur.execute("DELETE FROM units WHERE building_id = ?", (building_id,))
        print(f"Removed {len(old_unit_ids)} old units and occupancies for {building_name}")

    units_to_insert = []
    people_to_insert = []
    occupancies_to_insert = []

    used_emails = set()

    for floor_num, apartments in RAW_DATA.items():
        floor_int = int(floor_num)
        storey_code = f"L{floor_int:02d}"
        
        for apt in apartments:
            apt_code = apt["Apartment"]
            area = float(apt["Area"])
            unit_id = str(uuid.uuid4())
            display_name = f"Căn hộ {apt_code}"
            address = f"Tầng {floor_int}, Tòa nhà {building_name} (CCM5)"
            cert_no = f"GCN-M5N-{floor_int:02d}{apt_code[-2:]}"
            ownership_term = random.choice(["Sở hữu lâu dài", "Sở hữu 50 năm", "Lâu dài"])

            # 1. Generate Primary Owner
            owner_name, owner_gender = generate_vietnamese_name()
            owner_id = str(uuid.uuid4())
            name_slug = remove_accents(owner_name).replace(" ", ".")
            email = f"{name_slug}.{random.randint(10, 99)}@gmail.com"
            while email in used_emails:
                email = f"{name_slug}.{random.randint(100, 999)}@gmail.com"
            used_emails.add(email)

            owner_person = (
                owner_id,
                org_id,
                owner_name,
                email,
                generate_phone(),
                generate_cccd(),
                generate_dob(28, 68),
                owner_gender,
                "active"
            )
            people_to_insert.append(owner_person)

            # Determine residency mode
            residence_mode = random.choices(["owner_occupied", "tenant_occupied", "co_owned"], weights=[0.7, 0.2, 0.1])[0]

            if residence_mode == "owner_occupied":
                owner_occ_id = str(uuid.uuid4())
                occupancies_to_insert.append((
                    owner_occ_id,
                    building_id,
                    unit_id,
                    owner_id,
                    "Chủ hộ",
                    "Thường trú",
                    datetime(2024, random.randint(1, 12), random.randint(1, 28)).isoformat(),
                    None,
                    "active"
                ))

                # Maybe add spouse
                if random.random() < 0.55:
                    spouse_gender = "female" if owner_gender == "male" else "male"
                    spouse_name, _ = generate_vietnamese_name(spouse_gender)
                    spouse_id = str(uuid.uuid4())
                    s_slug = remove_accents(spouse_name).replace(" ", ".")
                    s_email = f"{s_slug}.{random.randint(10, 99)}@gmail.com"
                    used_emails.add(s_email)

                    people_to_insert.append((
                        spouse_id,
                        org_id,
                        spouse_name,
                        s_email,
                        generate_phone(),
                        generate_cccd(),
                        generate_dob(25, 65),
                        spouse_gender,
                        "active"
                    ))
                    occupancies_to_insert.append((
                        str(uuid.uuid4()),
                        building_id,
                        unit_id,
                        spouse_id,
                        "Vợ/Chồng",
                        "Thường trú",
                        datetime(2024, 1, 1).isoformat(),
                        None,
                        "active"
                    ))

                # Maybe add child
                if random.random() < 0.40:
                    child_gender = random.choice(["male", "female"])
                    child_name, _ = generate_vietnamese_name(child_gender)
                    child_id = str(uuid.uuid4())
                    c_slug = remove_accents(child_name).replace(" ", ".")
                    c_email = f"{c_slug}.{random.randint(10, 99)}@gmail.com"
                    used_emails.add(c_email)

                    people_to_insert.append((
                        child_id,
                        org_id,
                        child_name,
                        c_email,
                        generate_phone(),
                        generate_cccd(),
                        generate_dob(5, 24),
                        child_gender,
                        "active"
                    ))
                    occupancies_to_insert.append((
                        str(uuid.uuid4()),
                        building_id,
                        unit_id,
                        child_id,
                        "Con cái",
                        "Thường trú",
                        datetime(2024, 1, 1).isoformat(),
                        None,
                        "active"
                    ))

            elif residence_mode == "tenant_occupied":
                occupancies_to_insert.append((
                    str(uuid.uuid4()),
                    building_id,
                    unit_id,
                    owner_id,
                    "Chủ sở hữu",
                    None,
                    datetime(2023, 6, 1).isoformat(),
                    None,
                    "active"
                ))

                tenant_name, tenant_gender = generate_vietnamese_name()
                tenant_id = str(uuid.uuid4())
                t_slug = remove_accents(tenant_name).replace(" ", ".")
                t_email = f"{t_slug}.{random.randint(10, 99)}@gmail.com"
                used_emails.add(t_email)

                people_to_insert.append((
                    tenant_id,
                    org_id,
                    tenant_name,
                    t_email,
                    generate_phone(),
                    generate_cccd(),
                    generate_dob(22, 50),
                    tenant_gender,
                    "active"
                ))
                occupancies_to_insert.append((
                    str(uuid.uuid4()),
                    building_id,
                    unit_id,
                    tenant_id,
                    "Người thuê nhà",
                    "Tạm trú (Thuê)",
                    datetime(2025, random.randint(1, 6), 1).isoformat(),
                    datetime(2026, 12, 31).isoformat(),
                    "active"
                ))

            else:  # co_owned
                occupancies_to_insert.append((
                    str(uuid.uuid4()),
                    building_id,
                    unit_id,
                    owner_id,
                    "Đồng sở hữu",
                    "Thường trú",
                    datetime(2024, 1, 1).isoformat(),
                    None,
                    "active"
                ))

                co_name, co_gender = generate_vietnamese_name()
                co_id = str(uuid.uuid4())
                co_slug = remove_accents(co_name).replace(" ", ".")
                co_email = f"{co_slug}.{random.randint(10, 99)}@gmail.com"
                used_emails.add(co_email)

                people_to_insert.append((
                    co_id,
                    org_id,
                    co_name,
                    co_email,
                    generate_phone(),
                    generate_cccd(),
                    generate_dob(25, 60),
                    co_gender,
                    "active"
                ))
                occupancies_to_insert.append((
                    str(uuid.uuid4()),
                    building_id,
                    unit_id,
                    co_id,
                    "Đồng sở hữu",
                    "Thường trú",
                    datetime(2024, 1, 1).isoformat(),
                    None,
                    "active"
                ))

            # Unit record
            unit_record = (
                unit_id,
                building_id,
                apt_code,
                display_name,
                "apartment",
                storey_code,
                "active",
                address,
                area,
                owner_name,
                cert_no,
                ownership_term
            )
            units_to_insert.append(unit_record)

    cur.executemany("""
        INSERT INTO units (id, building_id, code, display_name, unit_type, storey_code, status, address, area, owner, certificate_number, ownership_term)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, units_to_insert)

    cur.executemany("""
        INSERT INTO people (id, organization_id, display_name, email, phone, citizen_id, date_of_birth, gender, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, people_to_insert)

    cur.executemany("""
        INSERT INTO occupancies (id, building_id, unit_id, person_id, relationship_type, residence_type, starts_at, ends_at, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, occupancies_to_insert)

    conn.commit()
    print(f"Successfully populated for {building_name}:")
    print(f"- {len(units_to_insert)} units")
    print(f"- {len(people_to_insert)} people (Vietnamese names with varied demographics)")
    print(f"- {len(occupancies_to_insert)} occupancies (Roles: Chu ho, Vo/Chong, Con cai, Nguoi thue, Dong so huu)")

    cur.execute("SELECT count(id) FROM units WHERE building_id = ?", (building_id,))
    print("Units count in DB for m5new:", cur.fetchone()[0])
    cur.execute("SELECT count(id) FROM occupancies WHERE building_id = ?", (building_id,))
    print("Occupancies count in DB for m5new:", cur.fetchone()[0])

    conn.close()

if __name__ == "__main__":
    populate()

