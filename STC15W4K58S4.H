/************************************************************
 * STC15W4K58S4.H - IAP15W4K58S4 寄存器定义头文件
 *
 * 适用芯片: IAP15W4K58S4 (STC15W4K58S4系列)
 * 封装: LQFP44 / LQFP48 / LQFP64
 * 内核: 1T 8051 (增强型)
 *
 * 说明: 本文件定义了STC15W4K58S4系列单片机的主要SFR，
 *       供Keil C51编译使用。如果已安装STC-ISP Keil仿真驱动，
 *       则此文件与官方STC15W4K58S4.H等效。
 *
 * 创建日期: 2026-07-08
 ************************************************************/

#ifndef __STC15W4K58S4_H__
#define __STC15W4K58S4_H__

/* ==================== 标准8051 SFR (地址兼容) ==================== */
// 注意: STC15系列为1T增强型内核，但这些标准SFR的地址
//       与传统8051完全一致，可直接使用。

sfr P0   = 0x80;
sfr SP   = 0x81;
sfr DPL  = 0x82;
sfr DPH  = 0x83;
sfr PCON = 0x87;
sfr TCON = 0x88;
sfr TMOD = 0x89;
sfr TL0  = 0x8A;
sfr TL1  = 0x8B;
sfr TH0  = 0x8C;
sfr TH1  = 0x8D;
sfr AUXR = 0x8E;
sfr P1   = 0x90;
sfr SCON = 0x98;
sfr SBUF = 0x99;
sfr P2   = 0xA0;
sfr IE   = 0xA8;
sfr P3   = 0xB0;
sfr IP   = 0xB8;
sfr P4   = 0xC0;
sfr P5   = 0xC8;
sfr PSW  = 0xD0;
sfr ACC  = 0xE0;
sfr B    = 0xF0;

/* ==================== STC15扩展SFR ==================== */

/* ---- I/O口模式配置 ---- */
sfr P0M0 = 0x93;   // P0口模式配置0
sfr P0M1 = 0x94;   // P0口模式配置1
sfr P1M0 = 0x91;   // P1口模式配置0
sfr P1M1 = 0x92;   // P1口模式配置1
sfr P2M0 = 0x95;   // P2口模式配置0
sfr P2M1 = 0x96;   // P2口模式配置1
sfr P3M0 = 0xB1;   // P3口模式配置0
sfr P3M1 = 0xB2;   // P3口模式配置1
sfr P4M0 = 0xB3;   // P4口模式配置0
sfr P4M1 = 0xB4;   // P4口模式配置1
sfr P5M0 = 0xC9;   // P5口模式配置0
sfr P5M1 = 0xCA;   // P5口模式配置1

/* ---- ADC ---- */
sfr P1ASF    = 0x9D;   // P1口模拟功能选择
sfr ADC_CONTR = 0xBC;   // ADC控制寄存器
sfr ADC_RES  = 0xBD;   // ADC结果高8位
sfr ADC_RESL = 0xBE;   // ADC结果低2位

/* ---- 串口2 ---- */
sfr S2CON  = 0x9A;   // 串口2控制寄存器
sfr S2BUF  = 0x9B;   // 串口2数据缓冲寄存器
sfr BRT    = 0x9C;   // 串口2波特率发生器

/* ---- 定时器2 ---- */
sfr T2H = 0xD6;   // 定时器2高8位
sfr T2L = 0xD7;   // 定时器2低8位

/* ---- PCA/PWM ---- */
sfr CCON  = 0xD8;   // PCA控制寄存器
sfr CMOD  = 0xD9;   // PCA模式寄存器
sfr CCAPM0 = 0xDA;  // PCA模块0比较/捕获寄存器
sfr CCAPM1 = 0xDB;  // PCA模块1比较/捕获寄存器
sfr CL    = 0xE9;   // PCA计数器低8位
sfr CH    = 0xF9;   // PCA计数器高8位

/* ---- 看门狗 ---- */
sfr WDT_CONTR = 0xC1;  // 看门狗控制寄存器

/* ---- 中断优先级扩展 ---- */
sfr IP2  = 0xB5;   // 中断优先级寄存器2
sfr IP2H = 0xB6;   // 中断优先级寄存器2高

/* ---- 电源控制 ---- */
sfr PCON2 = 0x97;   // 电源控制寄存器2

/* ---- 比较器 ---- */
sfr CMPCR1 = 0xE6;   // 比较器控制寄存器1
sfr CMPCR2 = 0xE7;   // 比较器控制寄存器2

/* ==================== 位定义 ==================== */

/* ---- TCON ---- */
sbit TF0 = TCON ^ 5;   // 定时器0溢出标志
sbit TR0 = TCON ^ 4;   // 定时器0运行控制
sbit TF1 = TCON ^ 7;   // 定时器1溢出标志
sbit TR1 = TCON ^ 6;   // 定时器1运行控制

/* ---- SCON ---- */
sbit RI   = SCON ^ 0;   // 接收中断标志
sbit TI   = SCON ^ 1;   // 发送中断标志
sbit REN  = SCON ^ 4;   // 接收使能

/* ---- IE ---- */
sbit EX0 = IE ^ 0;   // 外部中断0使能
sbit ET0 = IE ^ 1;   // 定时器0中断使能
sbit EX1 = IE ^ 2;   // 外部中断1使能
sbit ET1 = IE ^ 3;   // 定时器1中断使能
sbit ES  = IE ^ 4;   // 串口1中断使能
sbit ET2 = IE ^ 5;   // 定时器2中断使能
sbit EA  = IE ^ 7;   // 总中断使能

/* ---- IP ---- */
sbit PX0 = IP ^ 0;   // 外部中断0优先级
sbit PT0 = IP ^ 1;   // 定时器0优先级
sbit PX1 = IP ^ 2;   // 外部中断1优先级
sbit PT1 = IP ^ 3;   // 定时器1优先级
sbit PS  = IP ^ 4;   // 串口1优先级

/* ---- P3 ---- */
sbit RXD  = P3 ^ 0;   // 串口1接收
sbit TXD  = P3 ^ 1;   // 串口1发送
sbit INT0 = P3 ^ 2;   // 外部中断0
sbit INT1 = P3 ^ 3;   // 外部中断1
sbit T0   = P3 ^ 4;   // 定时器0外部输入
sbit T1   = P3 ^ 5;   // 定时器1外部输入
sbit WR   = P3 ^ 6;   // 外部数据存储器写
sbit RD   = P3 ^ 7;   // 外部数据存储器读

/* ---- CCON(PCA) ---- */
sbit CF   = CCON ^ 7;   // PCA计数器溢出标志
sbit CR   = CCON ^ 6;   // PCA计数器运行控制
sbit CCF0 = CCON ^ 0;   // PCA模块0中断标志
sbit CCF1 = CCON ^ 1;   // PCA模块1中断标志

/* ---- ADC_CONTR ---- */
// ADC_CONTR位: ADC_POWER(7) | SPEED1(6) | SPEED0(5) | ADC_FLAG(4)
//              | ADC_START(3) | CHS2(2) | CHS1(1) | CHS0(0)

#define ADC_POWER  0x80   // ADC电源控制位
#define ADC_SPEED  0x60   // ADC速度控制
#define ADC_FLAG   0x10   // ADC转换完成标志
#define ADC_START  0x08   // ADC启动转换

/* ==================== I/O口模式宏 ==================== */
// PxM1 PxM0 = 00: 准双向口(默认)
// PxM1 PxM0 = 01: 推挽输出
// PxM1 PxM0 = 10: 高阻输入
// PxM1 PxM0 = 11: 开漏输出

// 设置P2.x为推挽输出
// P2M0 |= (1<<x);  P2M1 &= ~(1<<x);

// 设置P2.x为高阻输入
// P2M0 &= ~(1<<x); P2M1 |= (1<<x);

#endif