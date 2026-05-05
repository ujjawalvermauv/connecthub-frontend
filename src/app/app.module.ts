import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { SidebarComponent } from './features/chat/sidebar/sidebar.component';
import { DirectMessagesComponent } from './features/pages/direct-messages/direct-messages.component';
import { RoomsComponent } from './features/pages/rooms/rooms.component';
import { SettingsComponent } from './features/pages/settings/settings.component';

import { MatIconModule } from '@angular/material/icon';

@NgModule({
  declarations: [
    AppComponent
  ],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    AppRoutingModule,
    SidebarComponent,
    DirectMessagesComponent,
    RoomsComponent,
    SettingsComponent,
    ReactiveFormsModule,
    FormsModule,
    HttpClientModule,
    MatIconModule
    // DO NOT import AuthModule here; it will be lazy loaded
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule {}
