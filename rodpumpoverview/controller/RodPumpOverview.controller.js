sap.ui.define([
	"com/pdms/og/rodpumpoverview/controller/BaseController",
	"sap/ui/model/json/JSONModel",
	"sap/ui/vk/ContentResource",
	"com/pdms/og/rodpumpoverview/model/formatter",
	"com/pdms/og/rodpumpoverview/control/DynaCard",
	"sap/ui/model/Sorter",
	"sap/ui/core/routing/History",
	"sap/ui/model/Filter",
	"sap/ui/model/FilterOperator"
], function(BaseController, JSONModel, ContentResource, formatter, DynaCard, Sorter, History, Filter, FilterOperator) {
	"use strict";

	return BaseController.extend("com.pdms.og.rodpumpoverview.controller.RodPumpOverview", {

		formatter: formatter,

		_aFilters: [],
		
		_oIcon : null,

		onInit: function() {
			var oModel = new sap.ui.model.json.JSONModel({
				"dynaCardType": "Pump",
				"logo": jQuery.sap.getModulePath('sap.ui.core', '/') + 'mimes/logo/sap_50x26.png',
				"ProductionMonitoringData": [],
				"PopoverChartData":[],
				"PumpManu":"",
				"PumpModel":"",
				"PumpRunningStatus":"",
				"InstallationDate":"",
				"ThingName":"",
				"PopoverTitle":""
			});
			this.setModel(oModel, "viewData");
			this.getRouter().getRoute("Home").attachPatternMatched(this._onRouteMatched, this);
		},

		_onRouteMatched: function() {
			var contentResource = new ContentResource({
				source: jQuery.sap.getModulePath("com.pdms.og.rodpumpoverview", "/model/OILWER.vds"),
				sourceType: "vds",
				id: "cr"
			});
			var oViewer = this.byId("RodViewer");
			oViewer.addContentResource(contentResource);
			var oThingFilter, oTimestampFilter, aFilters = [], sThingId = localStorage.getItem("po-ThingId"),
				sTimestamp = localStorage.getItem("po-Timestamp");
			this.getModel("viewData").setProperty("/ThingId", sThingId);
			this.getModel("viewData").setProperty("/Timestamp", sTimestamp);
			oThingFilter = new Filter("Thing", FilterOperator.EQ, sThingId);
			oTimestampFilter = new Filter("AlertStartDate", FilterOperator.EQ, sTimestamp);
			aFilters.push(oThingFilter);
			aFilters.push(oTimestampFilter);
			this.getView().setBusy(true);
			this.getModel().read("/RodPumpData", {
				filters: aFilters,
				success: this._onReadProdDataSuccess.bind(this),
				error: this._onReadProdDataError.bind(this)
			});
			
			this._fnGetDynaCard("Pump");
		},

		_onReadProdDataSuccess: function(oData) {
			this.getView().setBusy(false);
			var aResData = oData.results;
			if(aResData.length > 0){
				this.getModel("viewData").setProperty("/ProductionMonitoringData", [aResData[0]]);
				this.getModel("viewData").setProperty("/PumpManu", aResData[0].PumpManufacturer);
				this.getModel("viewData").setProperty("/PumpModel", aResData[0].PumpModel);
				this.getModel("viewData").setProperty("/PumpRunningStatus", aResData[0].PumpRunningStatus);
				this.getModel("viewData").setProperty("/InstallationDate", aResData[0].InstallationDate);
				this.getModel("viewData").setProperty("/ThingName", aResData[0].ThingName);
				this.getModel("viewData").setProperty("/AlertStartDate", aResData[0].AlertStartDate);
				this.getModel("viewData").setProperty("/AlertStatus", aResData[0].AlertStatus);
				this.getModel("viewData").setProperty("/AlertDescription", aResData[0].AlertDescription);
				this.getModel("viewData").setProperty("/WellName", aResData[0].WellName);
				
			}
		},
		_onReadProdDataError: function() {
			this.getView().setBusy(false);
		},
		
		onCreatePMNotification:function(){
			window.location= "/app/ahcc/index.html#/FactSheet/" + localStorage.getItem("po-ThingId");
		},
		
		onIconPress: function(oEvent) {
			this._oIcon = oEvent.getSource();
			this._getProductionPopoverData();
			this.getModel("viewData").setProperty("/PopoverTitle", oEvent.getSource().getParent().getParent().getItems()[0].getText());
		},
		onEmailPress:function(oEvent){
		 var sSubject = this.getModel("viewData").getProperty("/ThingName")+":"+this.getModel("viewData").getProperty("/AlertDescription"), 
		 oBody= "Well Name:"+this.getModel("viewData").getProperty("/WellName")+"\n"+"Manufacture:"+this.getModel("viewData").getProperty("/PumpManu")+"\n"+"Model:"+this.getModel("viewData").getProperty("/PumpModel")+"\n"+"Installation Date:"+this.getModel("viewData").getProperty("/InstallationDate");
		 sap.m.URLHelper.triggerEmail(sSubject,oBody);
		},
		
		_getProductionPopoverData:function(){
			var endDate = localStorage.getItem("po-Timestamp"), startDate, aFilters=[], datechange, dateFilter;
			datechange = new Date(endDate);
			datechange.setDate(datechange.getDate()-5);
			startDate = datechange.toISOString();
			dateFilter = new Filter("AlertStartDate", FilterOperator.BT, startDate, endDate);
			aFilters.push(dateFilter);
			this.getView().setBusy(true);
			this.getView().getModel().read(
			"/RodPumpData", {
				filters: aFilters,
				success: this._onProductionPopoverReadSuccess.bind(this),
				error: this._onProductionPopoverReadError.bind(this)
			});
		},
		
		_onProductionPopoverReadSuccess:function(oData){
			this.getView().setBusy(false);
			var i, sChartType, aChartData=[], oRespData = oData.results, oViewModel = this.getModel("viewData");
			sChartType = oViewModel.getProperty("/PopoverTitle");
			for(i = 0;i < oRespData.length; i++){
				var oChartObj = {};
				if(sChartType === "Load Cell"){
					oChartObj.Timestamp = oRespData[i].AlertStartDate ? oRespData[i].AlertStartDate.getDate() : "";
					oChartObj.Parameter = oRespData[i].LoadAtSurfaceLevel;
				}else{
					oChartObj.Timestamp = oRespData[i].AlertStartDate ? oRespData[i].AlertStartDate.getDate() : "";
					oChartObj.Parameter = oRespData[i].StrokesPerMinute;
				}
				aChartData.push(oChartObj);
			}
			oViewModel.setProperty("/PopoverChartData", aChartData);
			jQuery.sap.delayedCall(0, this, function() {
				this._getChartPopover().openBy(this._oIcon);
			});
		},
		
		_onProductionPopoverReadError:function(){
			this.getView().setBusy(false);
		},

		onBeforeRendering: function() {},

		onDynaCardTypeChange: function(oEvent) {
			var sKey = oEvent.getParameter("selectedItem").getKey();
			this._sCardType = sKey;
			this.getView().setBusy(true);
			this._fnGetDynaCard(sKey);
		},

		_fnGetDynaCard: function(sCardType) {
			var /*oTimeStampSorter, oThingFilter, oTimestampFilter, aFilters = [], aSorters = [],*/
			sThingId = localStorage.getItem("po-ThingId"),
			sTimestamp = localStorage.getItem("po-Timestamp");
			/*oTimeStampSorter = new Sorter("Timestamp", true);
			aSorters.push(oTimeStampSorter);
			oThingFilter = new Filter("Thing", FilterOperator.EQ, sThingId);
			oTimestampFilter = new Filter("Timestamp", FilterOperator.EQ, sTimestamp);
			aFilters.push(oThingFilter);
			aFilters.push(oTimestampFilter);*/
			var odynaSurfaceCardDataModel = new JSONModel();
			this.getView().setBusy(true);
			odynaSurfaceCardDataModel.loadData("./localService/mockdata/EX_SURFACE_DATA.json",{
				"thing":sThingId,
				"timestamp":sTimestamp
			});
			odynaSurfaceCardDataModel.attachRequestCompleted(this._surfaceDataSuccess,this);
			odynaSurfaceCardDataModel.attachRequestFailed(this._surfaceDataFailure,this);
			/*this.getModel("ControllerDataModel").read("/" + sCardType, {
				//filters: aFilters,
				sorters: aSorters,
				success: this._onGetDynaCardDataSuccess.bind(this),
				error: this._onGetDynaCardDataError.bind(this)
			});*/
		},
		
		_surfaceDataSuccess: function(oEvent){
			this.getView().setBusy(false);
			var surfaceData = oEvent.getSource().getData();
		},
		
		_surfaceDataFailure: function(){
			this.getView().setBusy(false);	
		},
		
		_onGetDynaCardDataSuccess: function(oData) {
			this.getView().setBusy(false);
			var oControl, oDynaContainer = this.byId("idDynacardLayout");
			oControl = new DynaCard({
				cardType: this._sCardType
			});
			oControl.setDynaCardData(oData.results);
			jQuery.sap.delayedCall(0, this, function() {
				oControl.drawDynaCard();
			});
			oDynaContainer.addContent(oControl);
		},

		_onGetDynaCardDataError: function(oError) {
			this.getView().setBusy(false);
		},
		/**
		 * Opens up an action sheet displaying Log Off button
		 * @param {sap.ui.base.Event} oEvent the press event
		 * @public
		 */
		onUserItemPressed: function(oEvent) {
			var oButton = oEvent.getSource();
			if (!this._userActionSheet) {
				this._userActionSheet = sap.ui.xmlfragment('com.pdms.og.rodpumpoverview.fragment.UserPreference', this);
				this.getView().addDependent(this._userActionSheet);
			}
			this._userActionSheet.openBy(oButton);
		},

		/**
		 *Logs off the user form the application and navigates back to login screen (XSUAA)
		 * @public
		 */
		onLogoffPress: function() {
			window.location.replace('/logout');
		},

		/**
		 * Navigates back to the PdMS Launchpad
		 * @public
		 */
		onBackNav: function() {
			var sPreviousHash = History.getInstance().getPreviousHash();
			if (sPreviousHash !== undefined) {
				history.go(-1);
			} else {
				window.location.replace("/app/pdovog/index.html");
			}
		},
		
		_getChartPopover: function(){
			if (!this._oPopover) {
				this._oPopover = sap.ui.xmlfragment("com.pdms.og.rodpumpoverview.fragment.ProductionPopover");
				this.getView().addDependent(this._oPopover);
			}
			return this._oPopover;
		}

	});

});